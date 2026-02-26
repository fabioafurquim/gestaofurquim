'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ExportButtons from './ExportButtons';

interface Team {
    id: number;
    name: string;
}

interface Physiotherapist {
    id: number;
    name: string;
}

interface TeamBreakdown {
    teamId: number;
    teamName: string;
    periods: {
        MORNING: number;
        INTERMEDIATE: number;
        AFTERNOON: number;
        NIGHT: number;
    };
    shiftValue: number;
    totalShifts: number;
    totalValue: number;
}

interface PhysioData {
    id: number;
    name: string;
    teamBreakdown: Record<number, TeamBreakdown>;
    totalShifts: number;
    totalValue: number;
    additionalValue: number;
}

interface Totals {
    morning: number;
    intermediate: number;
    afternoon: number;
    night: number;
    shiftValue: number;
    totalShiftValue: number;
    additionalValue: number;
}

interface FinancialReportClientProps {
    initialFilters: {
        year: number;
        month: number;
        teamId?: number;
        physioId?: number;
    };
    teams: Team[];
    physiotherapists: Physiotherapist[];
    data: PhysioData[];
    totals: Totals;
    grandTotal: number;
    entries: number;
    months: number[];
    years: number[];
    periodLabels: Record<string, string>;
}

export default function FinancialReportClient({
    initialFilters,
    teams,
    physiotherapists,
    data,
    totals,
    grandTotal,
    entries,
    months,
    years,
    periodLabels
}: FinancialReportClientProps) {
    const router = useRouter();
    const [selectedYear, setSelectedYear] = useState(initialFilters.year);
    const [selectedMonth, setSelectedMonth] = useState(initialFilters.month);
    const [selectedTeam, setSelectedTeam] = useState(initialFilters.teamId || '');
    const [selectedPhysio, setSelectedPhysio] = useState(initialFilters.physioId || '');

    const handleFilterChange = () => {
        const params = new URLSearchParams();
        params.set('year', selectedYear.toString());
        params.set('month', selectedMonth.toString());
        if (selectedTeam) params.set('teamId', selectedTeam.toString());
        if (selectedPhysio) params.set('physioId', selectedPhysio.toString());
        
        router.push(`/reports/financial?${params.toString()}`);
    };

    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Relatório Financeiro</h1>
                <Link
                    href="/reports"
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    Voltar
                </Link>
            </div>

            {/* Filtros */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Ano */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ano
                        </label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            {years.map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Mês */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Mês
                        </label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            {months.map((month) => (
                                <option key={month} value={month}>
                                    {monthNames[month - 1]}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Equipe */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Equipe
                        </label>
                        <select
                            value={selectedTeam}
                            onChange={(e) => setSelectedTeam(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Todas as equipes</option>
                            {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Fisioterapeuta */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Fisioterapeuta
                        </label>
                        <select
                            value={selectedPhysio}
                            onChange={(e) => setSelectedPhysio(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Todos os fisioterapeutas</option>
                            {physiotherapists.map((physio) => (
                                <option key={physio.id} value={physio.id}>
                                    {physio.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-4 flex gap-2">
                    <button
                        onClick={handleFilterChange}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        Aplicar Filtros
                    </button>
                </div>
            </div>

            {/* Botões de Exportação */}
            <ExportButtons
                year={initialFilters.year}
                month={initialFilters.month}
                teamId={initialFilters.teamId}
                physioId={initialFilters.physioId}
            />

            {data.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-yellow-800">
                        Nenhum dado encontrado para os filtros selecionados.
                    </p>
                </div>
            ) : (
                <>
                    {/* Resumo Financeiro */}
                    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                        <div className="bg-gray-50 px-6 py-4 border-b">
                            <h2 className="text-xl font-semibold text-gray-800">
                                Resumo Financeiro - {monthNames[initialFilters.month - 1]} {initialFilters.year}
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            {data.map((physio) => {
                                const totalValue = physio.totalValue + physio.additionalValue;
                                const teamBreakdowns = Object.values(physio.teamBreakdown);
                                
                                return (
                                    <div key={physio.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                                        <div className="flex flex-col space-y-2">
                                            {/* Nome do Fisioterapeuta */}
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {physio.name}
                                            </h3>
                                            
                                            {/* Equipes e Quantidades */}
                                            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                                {teamBreakdowns.map((team) => {
                                                    const totalShiftsForTeam = team.periods.MORNING + team.periods.INTERMEDIATE + team.periods.AFTERNOON + team.periods.NIGHT;
                                                    return (
                                                        <span key={team.teamId} className="bg-gray-100 px-3 py-1 rounded-full">
                                                            {team.teamName} - {totalShiftsForTeam} plantão{totalShiftsForTeam !== 1 ? 'ões' : ''}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            
                                            {/* Valores */}
                                            <div className="flex justify-between items-center pt-2">
                                                <div className="flex space-x-6 text-sm">
                                                    <span className="text-gray-600">
                                                        Valor Plantões: <span className="font-medium text-gray-900">R$ {physio.totalValue.toFixed(2)}</span>
                                                    </span>
                                                    <span className="text-gray-600">
                                                        Valor Adicional: <span className="font-medium text-gray-900">R$ {physio.additionalValue.toFixed(2)}</span>
                                                    </span>
                                                </div>
                                                <div className="text-lg font-bold text-gray-900">
                                                    Total: R$ {totalValue.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {/* Total Geral */}
                            <div className="border-t-2 border-gray-300 pt-4 mt-6">
                                <div className="flex justify-between items-center">
                                    <div className="flex space-x-6">
                                        <span className="text-lg font-semibold text-gray-700">
                                            Total Plantões: <span className="text-gray-900">R$ {totals.shiftValue.toFixed(2)}</span>
                                        </span>
                                        <span className="text-lg font-semibold text-gray-700">
                                            Total Adicional: <span className="text-gray-900">R$ {totals.additionalValue.toFixed(2)}</span>
                                        </span>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-900">
                                        TOTAL GERAL: R$ {grandTotal.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detalhamento por Fisioterapeuta e Equipe */}
                    <div className="space-y-6">
                        {data.map((physio) => {
                            const totalValue = physio.totalValue + physio.additionalValue;
                            const teamBreakdownArray = Object.values(physio.teamBreakdown);

                            return (
                                <div key={physio.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                                    <div className="bg-blue-50 px-6 py-4 border-b">
                                        <h3 className="text-lg font-semibold text-gray-800">
                                            {physio.name} - Total: R$ {totalValue.toFixed(2)}
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Equipe
                                                    </th>
                                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Manhã
                                                    </th>
                                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Interm.
                                                    </th>
                                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Tarde
                                                    </th>
                                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Noite
                                                    </th>
                                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Total
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Valor Unit.
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        Subtotal
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {teamBreakdownArray.map((team) => {
                                                    const totalShiftsTeam = team.periods.MORNING + team.periods.INTERMEDIATE + team.periods.AFTERNOON + team.periods.NIGHT;
                                                    return (
                                                    <tr key={team.teamId} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                            {team.teamName}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                                            {team.periods.MORNING || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                                            {team.periods.INTERMEDIATE || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                                            {team.periods.AFTERNOON || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                                            {team.periods.NIGHT || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700 text-center">
                                                            {totalShiftsTeam}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                            R$ {team.shiftValue.toFixed(2)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                                                            R$ {team.totalValue.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot className="bg-gray-50">
                                                <tr>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                                        Subtotal Plantões
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-center">
                                                        {Object.values(physio.teamBreakdown).reduce((sum, team) => sum + team.periods.MORNING, 0) || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-center">
                                                        {Object.values(physio.teamBreakdown).reduce((sum, team) => sum + team.periods.INTERMEDIATE, 0) || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-center">
                                                        {Object.values(physio.teamBreakdown).reduce((sum, team) => sum + team.periods.AFTERNOON, 0) || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-center">
                                                        {Object.values(physio.teamBreakdown).reduce((sum, team) => sum + team.periods.NIGHT, 0) || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-center">
                                                        {physio.totalShifts}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                                        -
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                                        R$ {physio.totalValue.toFixed(2)}
                                                    </td>
                                                </tr>
                                                {physio.additionalValue > 0 && (
                                                    <tr>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-700" colSpan={7}>
                                                            Valor Adicional
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-700 text-right">
                                                            R$ {physio.additionalValue.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                )}
                                                <tr className="bg-indigo-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-700" colSpan={7}>
                                                        TOTAL {physio.name.toUpperCase()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-700 text-right">
                                                        R$ {totalValue.toFixed(2)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}