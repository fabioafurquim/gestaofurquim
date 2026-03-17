import { NextResponse } from 'next/server';
import { startOfMonth } from 'date-fns';
import { ShiftPeriod } from '@prisma/client';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

const PERIOD_END_TIMES: Record<ShiftPeriod, { hour: number; nextDay?: boolean }> = {
  MORNING: { hour: 13 },
  INTERMEDIATE: { hour: 19 },
  AFTERNOON: { hour: 19 },
  NIGHT: { hour: 7, nextDay: true },
};

function getShiftCompletionDate(date: Date, period: ShiftPeriod) {
  const completion = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const config = PERIOD_END_TIMES[period];

  if (config.nextDay) {
    completion.setDate(completion.getDate() + 1);
  }

  completion.setHours(config.hour, 0, 0, 0);

  return completion;
}

export async function GET() {
  try {
    const { error, user } = await requireAuth();
    if (error) return error;

    if (user?.role === 'USER') {
      return NextResponse.json({ error: 'Acesso negado para este painel' }, { status: 403 });
    }

    const now = new Date();
    const monthStartLocal = startOfMonth(now);
    const monthStartUtc = new Date(Date.UTC(monthStartLocal.getFullYear(), monthStartLocal.getMonth(), 1, 0, 0, 0));
    const nextMonthStartUtc = new Date(Date.UTC(monthStartLocal.getFullYear(), monthStartLocal.getMonth() + 1, 1, 0, 0, 0));
    const todayStartUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
    const tomorrowStartUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0));

    const [totalPhysiotherapists, activePhysiotherapists, totalTeams, shiftsThisMonth, shiftsToday, latestShifts] =
      await Promise.all([
        prisma.physiotherapist.count(),
        prisma.physiotherapist.count({
          where: { status: 'ACTIVE' },
        }),
        prisma.shiftTeam.count(),
        prisma.shift.count({
          where: {
            date: {
              gte: monthStartUtc,
              lt: nextMonthStartUtc,
            },
          },
        }),
        prisma.shift.count({
          where: {
            date: {
              gte: todayStartUtc,
              lt: tomorrowStartUtc,
            },
          },
        }),
        prisma.shift.findMany({
          include: {
            physiotherapist: {
              select: { name: true },
            },
            shiftTeam: {
              select: { name: true },
            },
          },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          take: 120,
        }),
      ]);

    const recentShifts = latestShifts
      .filter((shift) => getShiftCompletionDate(shift.date, shift.period) <= now)
      .sort((left, right) => {
        return getShiftCompletionDate(right.date, right.period).getTime() - getShiftCompletionDate(left.date, left.period).getTime();
      })
      .slice(0, 5)
      .map((shift) => ({
        id: shift.id,
        date: shift.date.toISOString(),
        period: shift.period,
        physiotherapistName: shift.physiotherapist.name,
        teamName: shift.shiftTeam.name,
      }));

    return NextResponse.json({
      stats: {
        totalPhysiotherapists,
        activePhysiotherapists,
        totalTeams,
        shiftsThisMonth,
        shiftsToday,
      },
      recentShifts,
    });
  } catch (error) {
    console.error('Erro ao carregar estatísticas do painel:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
