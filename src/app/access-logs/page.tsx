'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AuthLayout from '@/components/AuthLayout';

interface AccessLog {
  id: number;
  userEmail: string;
  userName: string;
  userRole: 'ADMIN' | 'MANAGER' | 'USER';
  ipAddress: string | null;
  userAgent: string | null;
  loggedInAt: string;
}

const roleLabels: Record<AccessLog['userRole'], string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  USER: 'Fisioterapeuta',
};

export default function AccessLogsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (session?.user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }

    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch('/api/access-logs?days=30&limit=300');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Não foi possível carregar os acessos.');
        }

        setLogs(Array.isArray(data) ? data : []);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Erro ao carregar acessos.');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [router, session, status]);

  return (
    <AuthLayout title="Log de Acessos">
      <div className="space-y-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Aqui ficam os logins realizados nos últimos 30 dias. O registro é feito no momento do acesso bem-sucedido.
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
            Nenhum acesso registrado no período.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Data e hora</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Perfil</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Navegador</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-sm text-slate-800">
                        {new Date(log.loggedInAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <p className="font-medium text-slate-900">{log.userName}</p>
                        <p className="text-slate-500">{log.userEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{roleLabels[log.userRole]}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{log.ipAddress || 'Não informado'}</td>
                      <td className="max-w-xs px-4 py-3 text-sm text-slate-500">
                        <span className="line-clamp-2">{log.userAgent || 'Não informado'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
