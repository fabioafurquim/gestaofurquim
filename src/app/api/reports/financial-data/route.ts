import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShiftPeriod } from '@prisma/client';
import {
    buildMonthlyShiftPaymentEntries,
    groupMonthlyShiftPaymentEntries,
} from '@/lib/payment-calculator';

const periodLabel: Record<ShiftPeriod, string> = {
    MORNING: 'Manhã',
    INTERMEDIATE: 'Intermediário',
    AFTERNOON: 'Tarde',
    NIGHT: 'Noite',
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
        const teamId = searchParams.get('teamId') ? parseInt(searchParams.get('teamId')!) : undefined;
        const physioId = searchParams.get('physioId') ? parseInt(searchParams.get('physioId')!) : undefined;
        const entries = await buildMonthlyShiftPaymentEntries(`${year}-${String(month).padStart(2, '0')}`, {
            teamId,
            physioId,
        });
        const summaries = groupMonthlyShiftPaymentEntries(entries);

        // Converter para o formato esperado pela UI
        const data = summaries.map((summary) => ({
            id: summary.physiotherapistId,
            name: summary.physiotherapistName,
            teamBreakdown: [...summary.teamBreakdown.values()].map((team) => ({
                teamId: team.teamId,
                teamName: team.teamName,
                periods: team.periods,
                shiftValue: team.totalShifts > 0 ? Number((team.totalValue / team.totalShifts).toFixed(2)) : 0,
                totalShifts: team.totalShifts,
                totalValue: team.totalValue,
            })),
            totalShifts: summary.totalShifts,
            totalValue: summary.totalShiftValue,
            additionalValue: summary.additionalValue,
        }));
        
        const totals = {
            morning: 0,
            intermediate: 0,
            afternoon: 0,
            night: 0,
            shiftValue: 0,
            totalShiftValue: 0,
            additionalValue: 0
        };

        data.forEach(physio => {
            physio.teamBreakdown.forEach(team => {
                totals.morning += team.periods.MORNING;
                totals.intermediate += team.periods.INTERMEDIATE;
                totals.afternoon += team.periods.AFTERNOON;
                totals.night += team.periods.NIGHT;
                totals.shiftValue += team.totalValue;
                totals.totalShiftValue += team.totalValue;
            });
            totals.additionalValue += physio.additionalValue;
        });

        const grandTotal = totals.totalShiftValue + totals.additionalValue;

        // Buscar dados auxiliares
        const [teams, physiotherapists] = await Promise.all([
            prisma.shiftTeam.findMany({
                orderBy: { name: 'asc' }
            }),
            prisma.physiotherapist.findMany({
                orderBy: { name: 'asc' }
            })
        ]);

        // Gerar listas de anos e meses
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
        const months = Array.from({ length: 12 }, (_, i) => i + 1);

        return NextResponse.json({
            data,
            totals,
            grandTotal,
            teams: teams.map(t => ({ id: t.id, name: t.name })),
            physiotherapists: physiotherapists.map(p => ({ id: p.id, name: p.name })),
            years,
            months,
            periodLabels: periodLabel,
            filters: { year, month, teamId, physioId }
        });

    } catch (error) {
        console.error('Erro ao buscar dados do relatório financeiro:', error);
        return NextResponse.json(
            { error: 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}
