'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AuthLayout from '@/components/AuthLayout';

interface DashboardStats {
  totalPhysiotherapists: number;
  activePhysiotherapists: number;
  totalTeams: number;
  shiftsThisMonth: number;
  shiftsToday: number;
  pendingApprovalSwapRequests: number;
}

interface RecentShift {
  id: number;
  date: string;
  period: string;
  physiotherapistName: string;
  teamName: string;
}

const periodLabels: Record<string, string> = {
  MORNING: 'Manhã',
  INTERMEDIATE: 'Intermediário',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noite',
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentShifts, setRecentShifts] = useState<RecentShift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'USER') {
      router.push('/dashboard-user');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    if (session?.user?.role === 'USER') {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard/stats');
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || 'Não foi possível carregar o painel');
        }

        setStats(json.stats);
        setRecentShifts(Array.isArray(json.recentShifts) ? json.recentShifts : []);
      } catch (error) {
        console.error('Erro ao carregar painel:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboardData();
  }, [session, status]);

  if (loading) {
    return (
      <AuthLayout title="Painel">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Painel">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Fisioterapeutas</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stats?.totalPhysiotherapists || 0}</p>
                <p className="mt-1 text-xs text-emerald-600">{stats?.activePhysiotherapists || 0} ativos</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Equipes</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stats?.totalTeams || 0}</p>
                <p className="mt-1 text-xs text-gray-500">cadastradas</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
                <svg className="h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Plantões Hoje</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stats?.shiftsToday || 0}</p>
                <p className="mt-1 text-xs text-gray-500">somados em todas as equipes</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Plantões no Mês</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stats?.shiftsThisMonth || 0}</p>
                <p className="mt-1 text-xs text-gray-500">somados em todas as equipes</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Trocas Pendentes</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stats?.pendingApprovalSwapRequests || 0}</p>
                <p className="mt-1 text-xs text-amber-600">aguardando aprovação da gestão</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {(stats?.pendingApprovalSwapRequests || 0) > 0 && (
          <Link
            href="/swap-board?filter=pending-approval"
            className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 transition-colors hover:bg-amber-100"
          >
            <div>
              <p className="text-sm font-semibold">Existem trocas aguardando aprovação</p>
              <p className="text-sm text-amber-800">
                {stats?.pendingApprovalSwapRequests} solicitação(ões) precisam de análise da gestão.
              </p>
            </div>
            <span className="text-sm font-semibold">Abrir mural →</span>
          </Link>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Ações Rápidas</h3>
            <div className="space-y-3">
              <Link href="/shifts" className="flex items-center gap-3 rounded-lg bg-indigo-50 p-3 transition-colors hover:bg-indigo-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Gerenciar Plantões</p>
                  <p className="text-xs text-gray-500">Adicionar ou editar plantões</p>
                </div>
              </Link>

              <Link href="/physiotherapists" className="flex items-center gap-3 rounded-lg bg-violet-50 p-3 transition-colors hover:bg-violet-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Fisioterapeutas</p>
                  <p className="text-xs text-gray-500">Gerenciar cadastros</p>
                </div>
              </Link>


              <Link href="/financial-closing" className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 transition-colors hover:bg-amber-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Fechamento Financeiro</p>
                  <p className="text-xs text-gray-500">Fechamento, relatórios e documentos</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Últimos Plantões</h3>
              <Link href="/shifts" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                Ver todos →
              </Link>
            </div>

            {recentShifts.length === 0 ? (
              <div className="py-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">Nenhum plantão realizado recentemente</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-2 py-3 text-left text-xs font-semibold uppercase text-gray-500">Data</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold uppercase text-gray-500">Período</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold uppercase text-gray-500">Fisioterapeuta</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold uppercase text-gray-500">Equipe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentShifts.map((shift) => (
                      <tr key={shift.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-3 text-sm text-gray-900">
                          {new Date(shift.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              shift.period === 'MORNING'
                                ? 'bg-blue-100 text-blue-700'
                                : shift.period === 'INTERMEDIATE'
                                ? 'bg-violet-100 text-violet-700'
                                : shift.period === 'AFTERNOON'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {periodLabels[shift.period] || shift.period}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-sm text-gray-900">{shift.physiotherapistName}</td>
                        <td className="px-2 py-3 text-sm text-gray-500">{shift.teamName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}



