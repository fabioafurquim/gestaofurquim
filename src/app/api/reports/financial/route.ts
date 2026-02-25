import { NextRequest, NextResponse } from 'next/server';
import { ShiftPeriod } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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

        // Agrupar dados por fisioterapeuta
        const byPhysio: Record<number, {
            id: number;
            name: string;
            shiftsByTeam: Record<string, { count: number; teamName: string; }>;
            totalShiftsValue: number;
            additionalValue: number;
        }> = {};

        for (const shift of shifts) {
            const physio = shift.physiotherapist;
            const team = shift.shiftTeam;
            
            if (!team || !physio) continue;

            const shiftValue = physio.hourValue?.toNumber() || 0;
            const additionalValue = physio.additionalValue?.toNumber() || 0;

            if (!byPhysio[physio.id]) {
                byPhysio[physio.id] = {
                    id: physio.id,
                    name: physio.name,
                    shiftsByTeam: {},
                    totalShiftsValue: 0,
                    additionalValue: additionalValue
                };
            }

            const teamName = team.name;
            if (!byPhysio[physio.id].shiftsByTeam[teamName]) {
                byPhysio[physio.id].shiftsByTeam[teamName] = {
                    count: 0,
                    teamName: teamName
                };
            }

            byPhysio[physio.id].shiftsByTeam[teamName].count++;
            byPhysio[physio.id].totalShiftsValue += shiftValue;
        }

        const financialSummary = Object.values(byPhysio).map(physioData => {
            const grandTotal = physioData.totalShiftsValue + physioData.additionalValue;
            return {
                ...physioData,
                shiftsByTeam: Object.values(physioData.shiftsByTeam),
                grandTotal
            };
        });

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
            data: financialSummary,
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