'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import AuthLayout from '@/components/AuthLayout';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardStats {
  shiftsThisMonth: number;
  upcomingShifts: number;
  completedShifts: number;
  pendingSwaps: number;
  recentShifts: Array<{
    id: number;
    date: string;
    period: string;
    teamName: string;
  }>;
  upcomingShiftsList: Array<{
    id: number;
    date: string;
    period: string;
    teamName: string;
  }>;
}

const periodLabels: Record<string, string> = {
  MORNING: 'Manhã',
  INTERMEDIATE: 'Intermediário',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noite',
};

export default function UserDashboardPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDashboardStats();
    }
  }, [status]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/user-stats');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar estatísticas');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <AuthLayout title="Meu Painel">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout title="Meu Painel">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Meu Painel">
      <div className="space-y-6">
        {/* Boas-vindas */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">
            Olá, {session?.user?.name?.split(' ')[0]}! 👋
          </h2>
          <p className="text-blue-100">
            Bem-vindo ao seu painel pessoal de plantões
          </p>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Plantões este Mês</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.shiftsThisMonth || 0}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Próximos Plantões</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.upcomingShifts || 0}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Plantões Realizados</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.completedShifts || 0}
                </p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Trocas Pendentes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.pendingSwaps || 0}
                </p>
              </div>
              <div className="bg-orange-100 rounded-full p-3">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Próximos Plantões */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Próximos Plantões</h3>
          </div>
          <div className="p-6">
            {stats?.upcomingShiftsList && stats.upcomingShiftsList.length > 0 ? (
              <div className="space-y-3">
                {stats.upcomingShiftsList.slice(0, 5).map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-600 text-white rounded-lg px-3 py-2 text-center min-w-[80px]">
                        <p className="text-xs font-medium">
                          {format(new Date(shift.date), 'MMM', { locale: ptBR }).toUpperCase()}
                        </p>
                        <p className="text-2xl font-bold">
                          {format(new Date(shift.date), 'dd')}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{shift.teamName}</p>
                        <p className="text-sm text-gray-600">{periodLabels[shift.period]}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(shift.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Nenhum plantão agendado
              </p>
            )}
          </div>
        </div>

        {/* Plantões Recentes */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Plantões Recentes</h3>
          </div>
          <div className="p-6">
            {stats?.recentShifts && stats.recentShifts.length > 0 ? (
              <div className="space-y-3">
                {stats.recentShifts.slice(0, 5).map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-gray-600 text-white rounded-lg px-3 py-2 text-center min-w-[80px]">
                        <p className="text-xs font-medium">
                          {format(new Date(shift.date), 'MMM', { locale: ptBR }).toUpperCase()}
                        </p>
                        <p className="text-2xl font-bold">
                          {format(new Date(shift.date), 'dd')}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{shift.teamName}</p>
                        <p className="text-sm text-gray-600">{periodLabels[shift.period]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Concluído
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Nenhum plantão realizado recentemente
              </p>
            )}
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/shifts"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 rounded-lg p-3 group-hover:bg-blue-200 transition-colors">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Ver Calendário</p>
                <p className="text-sm text-gray-600">Visualizar todos os plantões</p>
              </div>
            </div>
          </a>

          <a
            href="/swap-board"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 rounded-lg p-3 group-hover:bg-orange-200 transition-colors">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Mural de Trocas</p>
                <p className="text-sm text-gray-600">Solicitar ou aceitar trocas</p>
              </div>
            </div>
          </a>

          <a
            href="/change-password"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-gray-100 rounded-lg p-3 group-hover:bg-gray-200 transition-colors">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Alterar Senha</p>
                <p className="text-sm text-gray-600">Gerenciar sua conta</p>
              </div>
            </div>
          </a>
        </div>
      </div>
    </AuthLayout>
  );
}
