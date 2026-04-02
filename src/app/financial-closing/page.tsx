'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

import AuthLayout from '@/components/AuthLayout';

type ClosingListItem = {
  id: number;
  referenceMonth: string;
  status: string;
  totalGrossValue: string | number;
  totalNetValue: string | number;
  _count?: {
    lines?: number;
  };
};

const closingStatusLabels: Record<string, string> = {
  DRAFT: 'Rascunho',
  UNDER_REVIEW: 'Em conferência',
  APPROVED_FOR_PAYMENT: 'Aprovado para pagamento',
  BANK_FILE_GENERATED: 'Lote gerado',
  BANK_SUBMITTED: 'Enviado ao banco',
  PAYMENT_CONFIRMED: 'Pagamento confirmado',
  CLOSED: 'Fechado',
  REOPENED: 'Reaberto',
  ARCHIVED: 'Arquivado',
};

function getStatusBadgeClass(status: string) {
  if (['APPROVED_FOR_PAYMENT', 'PAYMENT_CONFIRMED', 'CLOSED'].includes(status)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['BANK_FILE_GENERATED', 'BANK_SUBMITTED'].includes(status)) {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }

  if (['UNDER_REVIEW', 'REOPENED'].includes(status)) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (status === 'ARCHIVED') {
    return 'border-slate-200 bg-slate-100 text-slate-600';
  }

  return 'border-blue-200 bg-blue-50 text-blue-700';
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function readJsonSafely(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  return JSON.parse(text);
}

export default function FinancialClosingPage() {
  const { data: session } = useSession();
  const [referenceMonth, setReferenceMonth] = useState(getCurrentMonth());
  const [closings, setClosings] = useState<ClosingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAccess = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';

  const reportQuery = useMemo(() => {
    const [year, month] = referenceMonth.split('-');
    return new URLSearchParams({
      year,
      month: String(Number(month)),
    }).toString();
  }, [referenceMonth]);

  async function loadClosings() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/financial-closing');
      const data = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error((data as { error?: string } | null)?.error || 'Erro ao carregar fechamentos.');
      }

      setClosings(((data as { closings?: ClosingListItem[] } | null)?.closings) || []);
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao carregar fechamentos.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateClosing() {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/financial-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceMonth,
          force: true,
        }),
      });
      const data = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error((data as { error?: string } | null)?.error || 'Erro ao gerar fechamento.');
      }

      await loadClosings();
    } catch (pageError) {
      setError(pageError instanceof Error ? pageError.message : 'Erro ao gerar fechamento.');
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (canAccess) {
      void loadClosings();
      return;
    }

    setLoading(false);
  }, [canAccess]);

  return (
    <AuthLayout title="Fechamento Financeiro" fullWidth>
      {!canAccess ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          Apenas gestores e administradores podem acessar o módulo financeiro.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Fechamento da competência</h2>
              <p className="mt-2 text-sm text-slate-600">
                Gere a competência oficial do mês e entre nela para conferir valores, ajustar, anexar RPA ou NF,
                gerar lote bancário, sincronizar comprovantes e enviar e-mails.
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div>
                  <label htmlFor="referenceMonth" className="mb-1 block text-sm font-medium text-slate-700">
                    Competência
                  </label>
                  <input
                    id="referenceMonth"
                    type="month"
                    value={referenceMonth}
                    onChange={(event) => setReferenceMonth(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGenerateClosing}
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {submitting ? 'Gerando...' : 'Gerar ou atualizar competência'}
                </button>

                <Link
                  href={`/financial-closing/${referenceMonth}`}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Abrir fechamento do mês
                </Link>
              </div>

              {error ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">Relatórios e exportações</h2>
              <p className="mt-2 text-sm text-slate-600">
                O fechamento vira a base única para relatórios detalhados, PDF geral, Excel e PDF bruto de RPA.
              </p>

              <div className="mt-5 flex flex-col gap-3">
                <Link
                  href={`/reports/financial?${reportQuery}`}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  Relatório detalhado por equipe e pessoa
                </Link>
                <Link
                  href={`/reports/financial/print?${reportQuery}`}
                  target="_blank"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Imprimir / PDF geral
                </Link>
                <Link
                  href={`/api/reports/financial/excel?${reportQuery}`}
                  target="_blank"
                  className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                >
                  Exportar Excel
                </Link>
                <Link
                  href={`/api/financial-closing/${referenceMonth}/rpa-gross-pdf`}
                  target="_blank"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  PDF bruto RPA
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Competências recentes</h3>
            </div>

            {loading ? (
              <div className="px-6 py-8 text-sm text-slate-500">Carregando fechamentos...</div>
            ) : closings.length === 0 ? (
              <div className="px-6 py-8 text-sm text-slate-500">Nenhum fechamento financeiro gerado ainda.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Competência</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Profissionais</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Bruto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Líquido</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {closings.map((closing) => (
                      <tr key={closing.id}>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{closing.referenceMonth}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(closing.status)}`}>
                            {closingStatusLabels[closing.status] || closing.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{closing._count?.lines ?? 0}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatCurrency(closing.totalGrossValue)}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatCurrency(closing.totalNetValue)}</td>
                        <td className="px-6 py-4 text-sm">
                          <Link
                            href={`/financial-closing/${closing.referenceMonth}`}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
                          >
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
