import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/teams/[id]/physiotherapists
 * Lista fisioterapeutas vinculados à equipe (para seleção no mural de trocas)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const teamId = parseInt(id, 10);
    if (isNaN(teamId)) {
      return NextResponse.json({ error: 'ID de equipe inválido' }, { status: 400 });
    }

    const currentPhysioId = session.user.physiotherapistId
      ? typeof session.user.physiotherapistId === 'string'
        ? parseInt(session.user.physiotherapistId, 10)
        : session.user.physiotherapistId
      : null;

    const physios = await prisma.physiotherapistTeam.findMany({
      where: {
        shiftTeamId: teamId,
        ...(currentPhysioId ? { physiotherapistId: { not: currentPhysioId } } : {}),
      },
      include: { physiotherapist: true },
      orderBy: {
        physiotherapist: { name: 'asc' },
      },
    });

    const result = physios.map((p) => ({ id: p.physiotherapist.id, name: p.physiotherapist.name }));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao listar fisioterapeutas da equipe:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
