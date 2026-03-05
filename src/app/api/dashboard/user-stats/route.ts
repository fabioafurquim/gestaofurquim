import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, startOfToday } from 'date-fns';

/**
 * GET /api/dashboard/user-stats
 * Retorna estatísticas personalizadas para o fisioterapeuta logado
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const physioId = session.user.physiotherapistId;
    if (!physioId) {
      return NextResponse.json({ error: 'Usuário não vinculado a um fisioterapeuta' }, { status: 400 });
    }

    const today = startOfToday();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    // Plantões deste mês
    const shiftsThisMonth = await prisma.shift.count({
      where: {
        physiotherapistId: physioId,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    // Próximos plantões (a partir de hoje)
    const upcomingShifts = await prisma.shift.count({
      where: {
        physiotherapistId: physioId,
        date: {
          gte: today,
        },
      },
    });

    // Plantões realizados (passados)
    const completedShifts = await prisma.shift.count({
      where: {
        physiotherapistId: physioId,
        date: {
          lt: today,
        },
      },
    });

    // Trocas pendentes (solicitadas por mim ou direcionadas a mim)
    const pendingSwaps = await prisma.shiftSwapRequest.count({
      where: {
        OR: [
          { requesterId: physioId, status: 'PENDING' },
          { targetPhysioId: physioId, status: 'PENDING' },
        ],
      },
    });

    // Lista dos próximos 5 plantões
    const upcomingShiftsList = await prisma.shift.findMany({
      where: {
        physiotherapistId: physioId,
        date: {
          gte: today,
        },
      },
      include: {
        shiftTeam: true,
      },
      orderBy: {
        date: 'asc',
      },
      take: 5,
    });

    // Lista dos últimos 5 plantões realizados
    const recentShifts = await prisma.shift.findMany({
      where: {
        physiotherapistId: physioId,
        date: {
          lt: today,
        },
      },
      include: {
        shiftTeam: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: 5,
    });

    return NextResponse.json({
      shiftsThisMonth,
      upcomingShifts,
      completedShifts,
      pendingSwaps,
      upcomingShiftsList: upcomingShiftsList.map((shift) => ({
        id: shift.id,
        date: shift.date.toISOString(),
        period: shift.period,
        teamName: shift.shiftTeam.name,
      })),
      recentShifts: recentShifts.map((shift) => ({
        id: shift.id,
        date: shift.date.toISOString(),
        period: shift.period,
        teamName: shift.shiftTeam.name,
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas do usuário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
