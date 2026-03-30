import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

/**
 * PATCH /api/swap-requests/[id]/reject
 * Rejeita uma solicitação de troca
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id;
    const swapRequestId = parseInt(id, 10);

    if (isNaN(swapRequestId)) {
      return NextResponse.json(
        { error: 'ID de solicitação inválido' },
        { status: 400 }
      );
    }

    // Busca a solicitação de troca
    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapRequestId },
      include: {
        shift: {
          include: {
            shiftTeam: true,
          },
        },
      },
    });

    if (!swapRequest) {
      return NextResponse.json(
        { error: 'Solicitação de troca não encontrada' },
        { status: 404 }
      );
    }

    const isManager = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';

    if (swapRequest.status === 'PENDING_APPROVAL' && isManager) {
      const updatedSwapRequest = await prisma.shiftSwapRequest.update({
        where: { id: swapRequestId },
        data: {
          status: 'REJECTED',
          approvedBy: userId,
          approvedAt: new Date(),
        },
        include: {
          shift: {
            include: {
              shiftTeam: true,
              physiotherapist: true,
            },
          },
          requester: true,
          targetPhysio: true,
          responder: true,
          approver: true,
        },
      });

      return NextResponse.json(updatedSwapRequest);
    }

    // Verifica se a solicitação está pendente
    if (swapRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Esta solicitação já foi respondida' },
        { status: 400 }
      );
    }

    // Busca o fisioterapeuta vinculado ao usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { physiotherapistId: true },
    });

    if (!user?.physiotherapistId) {
      return NextResponse.json(
        { error: 'Usuário não está vinculado a um fisioterapeuta' },
        { status: 400 }
      );
    }

    // Verifica se o usuário pode rejeitar esta troca
    const canReject = swapRequest.targetPhysioId === user.physiotherapistId;

    if (!canReject) {
      return NextResponse.json(
        { error: 'Você não pode rejeitar esta troca' },
        { status: 403 }
      );
    }

    // Atualiza a solicitação de troca
    const updatedSwapRequest = await prisma.shiftSwapRequest.update({
      where: { id: swapRequestId },
      data: {
        status: 'REJECTED',
        responderId: user.physiotherapistId,
        respondedAt: new Date(),
      },
      include: {
        shift: {
          include: {
            shiftTeam: true,
            physiotherapist: true,
          },
        },
        requester: true,
        targetPhysio: true,
        responder: true,
      },
    });

    return NextResponse.json(updatedSwapRequest);
  } catch (error) {
    console.error('Erro ao rejeitar solicitação de troca:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
