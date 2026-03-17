'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AuthLayout from '@/components/AuthLayout';

interface ShiftDeletionLog {
  id: number;
  physiotherapistName: string;
  shiftTeamName: string;
  deletedByUserName: string;
  deletedByUserRole: 'ADMIN' | 'MANAGER' | 'USER';
  deletedOwnShift: boolean;
  period: 'MORNING' | 'INTERMEDIATE' | 'AFTERNOON' | 'NIGHT';
  shiftDate: string;
  createdAt: string;
  notifiedViaTelegram: boolean;
  notificationTargets: string | null;
  notificationError: string | null;
}

const periodLabels: Record<ShiftDeletionLog['period'], string> = {
  MORNING: 'Manhã',
  INTERMEDIATE: 'Intermediário',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noite',
};

const roleLabels: Record<ShiftDeletionLog['deletedByUserRole'], string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  USER: 'Fisioterapeuta',
};

export default function ShiftDeletionHistoryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [logs, setLogs] = useState<ShiftDeletionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'MANAGER') {
      router.push('/');
      return;
    }

    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch('/api/shift-deletion-history?limit=100');

        if (!response.ok) {
          throw new Error('NÃ£o foi possÃ­vel carregar o histÃ³rico.');
        }

        const data = await response.json();
        setLogs(Array.isArray(data) ? data : []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Erro ao carregar histÃ³rico.');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [router, session, status]);

  return (
    <AuthLayout title="Histórico de Exclusões">
      <div className="space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Toda exclusão de plantão fica registrada aqui. Quando a exclusão é feita por um fisioterapeuta, o envio via Telegram depende da configuração atual do sistema.
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-48 items-center justify-center rounded-lg border bg-white">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border bg-white px-6 py-10 text-center text-sm text-gray-500">
            Nenhuma exclusão registrada até o momento.
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                        Exclusão #{log.id}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {log.deletedOwnShift ? 'Autoexclusão' : 'Exclusão administrativa'}
                      </span>
                      {log.notifiedViaTelegram && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          Telegram enviado
                        </span>
                      )}
                    </div>

                    <p className="text-base font-semibold text-gray-900">
                      {log.physiotherapistName} • {periodLabels[log.period]} • {log.shiftTeamName}
                    </p>

                    <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                      <p>
                        <span className="font-medium text-gray-800">Data do plantão:</span>{' '}
                        {new Date(log.shiftDate).toLocaleDateString('pt-BR')}
                      </p>
                      <p>
                        <span className="font-medium text-gray-800">Excluído em:</span>{' '}
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </p>
                      <p>
                        <span className="font-medium text-gray-800">Responsável:</span>{' '}
                        {log.deletedByUserName} ({roleLabels[log.deletedByUserRole]})
                      </p>
                      <p>
                        <span className="font-medium text-gray-800">Alerta Telegram:</span>{' '}
                        {log.notifiedViaTelegram ? 'Enviado' : 'Não enviado'}
                      </p>
                    </div>
                  </div>
                </div>

                {(log.notificationTargets || log.notificationError) && (
                  <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {log.notificationTargets && (
                      <p>
                        <span className="font-medium text-slate-900">Destinatários:</span>{' '}
                        {log.notificationTargets}
                      </p>
                    )}
                    {log.notificationError && (
                      <p>
                        <span className="font-medium text-slate-900">Observação:</span>{' '}
                        {log.notificationError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
