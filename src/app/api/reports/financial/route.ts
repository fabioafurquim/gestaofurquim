import { NextRequest, NextResponse } from 'next/server';
import { ShiftPeriod } from '@prisma/client';

import { prisma } from '@/lib/prisma';
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

    const financialSummary = summaries.map((physioData) => ({
      id: physioData.physiotherapistId,
      name: physioData.physiotherapistName,
      shiftsByTeam: [...physioData.teamBreakdown.values()].map((team) => ({
        count: team.totalShifts,
        teamName: team.teamName,
      })),
      totalShiftsValue: physioData.totalShiftValue,
      additionalValue: physioData.additionalValue,
      grandTotal: physioData.grossValue,
    }));

    const [teams, physiotherapists] = await Promise.all([
      prisma.shiftTeam.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.physiotherapist.findMany({
        orderBy: { name: 'asc' },
      }),
    ]);

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return NextResponse.json({
      data: financialSummary,
      teams: teams.map((team) => ({ id: team.id, name: team.name })),
      physiotherapists: physiotherapists.map((physio) => ({ id: physio.id, name: physio.name })),
      years,
      months,
      periodLabels: periodLabel,
      filters: { year, month, teamId, physioId },
    });
  } catch (error) {
    console.error('Erro ao buscar dados do relatório financeiro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
