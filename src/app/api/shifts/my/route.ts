import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { startOfToday } from 'date-fns';

/**
 * GET /api/shifts/my
 * Lista plantões futuros do fisioterapeuta logado
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

    const shifts = await prisma.shift.findMany({
      where: {
        physiotherapistId: physioId,
        date: {
          gte: today,
        },
      },
      include: {
        shiftTeam: true,
        physiotherapist: true,
      },
      orderBy: [{ date: 'asc' }, { period: 'asc' }],
    });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error('Erro ao buscar plantões do usuário:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
