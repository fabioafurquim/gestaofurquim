'use client';

import { useState, useEffect } from 'react';
import AuthLayout from '@/components/AuthLayout';
import Link from 'next/link';

interface DashboardStats {
  totalPhysiotherapists: number;
  activePhysiotherapists: number;
  totalTeams: number;
  shiftsThisMonth: number;
  shiftsToday: number;
  pendingPayments: number;
  totalPaymentsThisMonth: number;
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentShifts, setRecentShifts] = useState<RecentShift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [physiosRes, teamsRes, shiftsRes] = await Promise.all([
          fetch('/api/physiotherapists'),
          fetch('/api/teams'),
          fetch('/api/shifts?limit=10')
        ]);

        const physiotherapists = await physiosRes.json();
        const teams = await teamsRes.json();
        const shifts = await shiftsRes.json();

        // Calcular estatísticas
        const activePhysios = Array.isArray(physiotherapists) 
          ? physiotherapists.filter((p: any) => p.status === 'ACTIVE').length 
          : 0;

        const today = new Date().toISOString().split('T')[0];
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const shiftsThisMonth = Array.isArray(shifts) 
          ? shifts.filter((s: any) => {
              const shiftDate = new Date(s.date);
              return shiftDate.getMonth() === currentMonth && shiftDate.getFullYear() === currentYear;
            }).length 
          : 0;

        const shiftsToday = Array.isArray(shifts)
          ? shifts.filter((s: any) => s.date.startsWith(today)).length
          : 0;

        setStats({
          totalPhysiotherapists: Array.isArray(physiotherapists) ? physiotherapists.length : 0,
          activePhysiotherapists: activePhysios,
          totalTeams: Array.isArray(teams) ? teams.length : 0,
          shiftsThisMonth,
          shiftsToday,
          pendingPayments: 0,
          totalPaymentsThisMonth: 0,
        });

        // Últimos plantões
        if (Array.isArray(shifts)) {
          const recent = shifts.slice(0, 5).map((s: any) => ({
            id: s.id,
            date: s.date,
            period: s.period,
            physiotherapistName: s.physiotherapist?.name || 'N/A',
            teamName: s.shiftTeam?.name || 'N/A',
          }));
          setRecentShifts(recent);
        }
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <AuthLayout title="Dashboard">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Dashboard">
      <div className="space-y-6">
        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Fisioterapeutas */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Fisioterapeutas</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalPhysiotherapists || 0}</p>
                <p className="text-xs text-emerald-600 mt-1">
                  {stats?.activePhysiotherapists || 0} ativos
                </p>
              </div>
              <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Equipes */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Equipes</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalTeams || 0}</p>
                <p className="text-xs text-gray-500 mt-1">cadastradas</p>
              </div>
              <div className="h-12 w-12 bg-violet-100 rounded-xl flex items-center justify-center">
                <svg className="h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Plantões Hoje */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Plantões Hoje</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.shiftsToday || 0}</p>
                <p className="text-xs text-gray-500 mt-1">agendados</p>
              </div>
              <div className="h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Plantões no Mês */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Plantões no Mês</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.shiftsThisMonth || 0}</p>
                <p className="text-xs text-gray-500 mt-1">realizados</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Seção de Ações Rápidas e Últimos Plantões */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ações Rápidas */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
            <div className="space-y-3">
              <Link 
                href="/shifts" 
                className="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Gerenciar Plantões</p>
                  <p className="text-xs text-gray-500">Adicionar ou editar plantões</p>
                </div>
              </Link>

              <Link 
                href="/physiotherapists" 
                className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 hover:bg-violet-100 transition-colors"
              >
                <div className="h-10 w-10 bg-violet-600 rounded-lg flex items-center justify-center">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Fisioterapeutas</p>
                  <p className="text-xs text-gray-500">Gerenciar cadastros</p>
                </div>
              </Link>

              <Link 
                href="/reports/financial" 
                className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                <div className="h-10 w-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Relatórios</p>
                  <p className="text-xs text-gray-500">Ver relatório financeiro</p>
                </div>
              </Link>

              <Link 
                href="/payment-control" 
                className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
              >
                <div className="h-10 w-10 bg-amber-600 rounded-lg flex items-center justify-center">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Folha de Pagamento</p>
                  <p className="text-xs text-gray-500">Gerar folha mensal</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Últimos Plantões */}
          <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Últimos Plantões</h3>
              <Link href="/shifts" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                Ver todos →
              </Link>
            </div>
            
            {recentShifts.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">Nenhum plantão registrado</p>
                <Link href="/shifts" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Adicionar primeiro plantão
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Data</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Período</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Fisioterapeuta</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">Equipe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentShifts.map((shift) => (
                      <tr key={shift.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-2 text-sm text-gray-900">
                          {new Date(shift.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            shift.period === 'MORNING' ? 'bg-blue-100 text-blue-700' :
                            shift.period === 'INTERMEDIATE' ? 'bg-violet-100 text-violet-700' :
                            shift.period === 'AFTERNOON' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {periodLabels[shift.period] || shift.period}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-900">{shift.physiotherapistName}</td>
                        <td className="py-3 px-2 text-sm text-gray-500">{shift.teamName}</td>
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
