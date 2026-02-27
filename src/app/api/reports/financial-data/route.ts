import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShiftPeriod } from '@prisma/client';

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

        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);

        const shifts = await prisma.shift.findMany({
            where: {
                date: { gte: start, lt: end },
                ...(teamId ? { shiftTeamId: teamId } : {}),
                ...(physioId ? { physiotherapistId: physioId } : {}),
            },
            include: { physiotherapist: true, shiftTeam: true },
            orderBy: { date: 'asc' },
        });

        // Buscar todas as relações PhysiotherapistTeam para obter os valores customizados
        // Usar try-catch para compatibilidade com bancos que ainda não têm customShiftValue
        const customValueMap = new Map<string, number | null>();
        try {
            const physiotherapistTeams = await prisma.physiotherapistTeam.findMany();
            for (const pt of physiotherapistTeams) {
                const key = `${pt.physiotherapistId}-${pt.shiftTeamId}`;
                // Usar any para evitar erro de tipo enquanto Prisma não é regenerado
                const customValue = (pt as any).customShiftValue;
                customValueMap.set(key, customValue ? Number(customValue) : null);
            }
        } catch (error) {
            console.log('customShiftValue não disponível no banco, usando valores padrão das equipes');
        }

        // Agrupar dados por fisioterapeuta
        const byPhysio: Record<number, {
            id: number;
            name: string;
            teamBreakdown: Record<number, {
                teamId: number;
                teamName: string;
                periods: Record<ShiftPeriod, number>;
                shiftValue: number;
                totalShifts: number;
                totalValue: number;
            }>;
            totalShifts: number;
            totalValue: number;
            additionalValue: number;
        }> = {};

        for (const shift of shifts) {
            const physio = shift.physiotherapist;
            const team = shift.shiftTeam;
            
            if (!team || !physio) continue;

            // Verificar se há valor customizado para este fisioterapeuta nesta equipe
            const customValueKey = `${physio.id}-${team.id}`;
            const customValue = customValueMap.get(customValueKey);
            
            // Usar valor customizado se existir, senão usar valor padrão da equipe
            const shiftValue = customValue !== null && customValue !== undefined 
                ? customValue 
                : (team.shiftValue?.toNumber() || 0);
            const additionalValue = physio.additionalValue?.toNumber() || 0;

            if (!byPhysio[physio.id]) {
                byPhysio[physio.id] = {
                    id: physio.id,
                    name: physio.name,
                    teamBreakdown: {},
                    totalShifts: 0,
                    totalValue: 0,
                    additionalValue: additionalValue
                };
            }

            if (!byPhysio[physio.id].teamBreakdown[team.id]) {
                byPhysio[physio.id].teamBreakdown[team.id] = {
                    teamId: team.id,
                    teamName: team.name,
                    periods: {
                        MORNING: 0,
                        INTERMEDIATE: 0,
                        AFTERNOON: 0,
                        NIGHT: 0
                    },
                    shiftValue: shiftValue,
                    totalShifts: 0,
                    totalValue: 0
                };
            }

            const teamBreakdown = byPhysio[physio.id].teamBreakdown[team.id];
            teamBreakdown.periods[shift.period]++;
            teamBreakdown.totalShifts++;
            teamBreakdown.totalValue += shiftValue;

            byPhysio[physio.id].totalShifts++;
            byPhysio[physio.id].totalValue += shiftValue;
        }

        // Converter para array e calcular totais gerais
        const data = Object.values(byPhysio).map(physioData => ({
            ...physioData,
            teamBreakdown: Object.values(physioData.teamBreakdown)
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