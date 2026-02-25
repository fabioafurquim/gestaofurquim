'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLayout from '@/components/AuthLayout';
import FinancialReportClient from './FinancialReportClient';

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

interface ApiResponse {
    data: PhysioData[];
    totals: Totals;
    grandTotal: number;
    teams: Team[];
    physiotherapists: Physiotherapist[];
    years: number[];
    months: number[];
    periodLabels: Record<string, string>;
    filters: {
        year: number;
        month: number;
        teamId?: number;
        physioId?: number;
    };
}

function FinancialReportContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reportData, setReportData] = useState<ApiResponse | null>(null);

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const year = parseInt(searchParams.get('year') || currentYear.toString());
    const month = parseInt(searchParams.get('month') || currentMonth.toString());
    const teamId = searchParams.get('teamId') ? parseInt(searchParams.get('teamId')!) : undefined;
    const physioId = searchParams.get('physioId') ? parseInt(searchParams.get('physioId')!) : undefined;

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                const params = new URLSearchParams({
                    year: year.toString(),
                    month: month.toString(),
                });

                if (teamId) params.append('teamId', teamId.toString());
                if (physioId) params.append('physioId', physioId.toString());

                const response = await fetch(`/api/reports/financial-data?${params}`);
                
                if (!response.ok) {
                    throw new Error('Erro ao carregar dados do relatório');
                }

                const data: ApiResponse = await response.json();
                setReportData(data);
            } catch (err) {
                console.error('Erro ao buscar dados:', err);
                setError(err instanceof Error ? err.message : 'Erro desconhecido');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [year, month, teamId, physioId]);

    if (loading) {
        return (
            <AuthLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Carregando relatório financeiro...</p>
                    </div>
                </div>
            </AuthLayout>
        );
    }

    if (error) {
        return (
            <AuthLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="text-red-500 text-xl mb-4">⚠️</div>
                        <p className="text-red-600 mb-4">{error}</p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Tentar Novamente
                        </button>
                    </div>
                </div>
            </AuthLayout>
        );
    }

    if (!reportData) {
        return (
            <AuthLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <p className="text-gray-600">Nenhum dado encontrado</p>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout>
            <FinancialReportClient
                initialFilters={reportData.filters}
                teams={reportData.teams}
                physiotherapists={reportData.physiotherapists}
                data={reportData.data}
                totals={reportData.totals}
                grandTotal={reportData.grandTotal}
                entries={reportData.data.length}
                months={reportData.months}
                years={reportData.years}
                periodLabels={reportData.periodLabels}
            />
        </AuthLayout>
    );
}

export default function FinancialReportPage() {
    return (
        <Suspense fallback={
            <AuthLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Carregando relatório...</p>
                    </div>
                </div>
            </AuthLayout>
        }>
            <FinancialReportContent />
        </Suspense>
    );
}