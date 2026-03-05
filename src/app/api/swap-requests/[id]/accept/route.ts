import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

/**
 * PATCH /api/swap-requests/[id]/accept
 * Aceita uma solicitação de troca e efetiva a troca de plantões
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

    // Busca a solicitação de troca
    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapRequestId },
      include: {
        shift: {
          include: {
            shiftTeam: true,
          },
        },
        requester: true,
      },
    });

    if (!swapRequest) {
      return NextResponse.json(
        { error: 'Solicitação de troca não encontrada' },
        { status: 404 }
      );
    }

    // Verifica se a solicitação está pendente
    if (swapRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Esta solicitação já foi respondida' },
        { status: 400 }
      );
    }

    // Verifica se o usuário pode aceitar esta troca
    // Pode aceitar se:
    // 1. É uma troca aberta (targetPhysioId = null) e está na mesma equipe
    // 2. É uma troca direcionada para ele (targetPhysioId = seu ID)
    const canAccept =
      swapRequest.targetPhysioId === user.physiotherapistId ||
      swapRequest.targetPhysioId === null;

    if (!canAccept) {
      return NextResponse.json(
        { error: 'Você não pode aceitar esta troca' },
        { status: 403 }
      );
    }

    // Se for troca aberta, verifica se o fisioterapeuta está na mesma equipe
    if (swapRequest.targetPhysioId === null) {
      const isInTeam = await prisma.physiotherapistTeam.findFirst({
        where: {
          physiotherapistId: user.physiotherapistId,
          shiftTeamId: swapRequest.shift.shiftTeamId,
        },
      });

      if (!isInTeam) {
        return NextResponse.json(
          { error: 'Você não está na equipe deste plantão' },
          { status: 403 }
        );
      }
    }

    // Verifica se o fisioterapeuta já tem plantão no mesmo dia/período
    const existingShift = await prisma.shift.findFirst({
      where: {
        date: swapRequest.shift.date,
        period: swapRequest.shift.period,
        physiotherapistId: user.physiotherapistId,
      },
    });

    if (existingShift) {
      return NextResponse.json(
        { error: 'Você já tem um plantão neste dia e período' },
        { status: 400 }
      );
    }

    // Verifica se trocas precisam de aprovação
    const settings = await prisma.systemSettings.findFirst();
    const requiresApproval = settings?.swapRequiresApproval ?? true;

    // Se requer aprovação, muda status para PENDING_APPROVAL
    // Se não requer, efetiva a troca imediatamente
    const result = await prisma.$transaction(async (tx) => {
      if (requiresApproval) {
        // Apenas marca como aguardando aprovação
        const updatedSwapRequest = await tx.shiftSwapRequest.update({
          where: { id: swapRequestId },
          data: {
            status: 'PENDING_APPROVAL',
            responderId: user.physiotherapistId!,
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

        return { swapRequest: updatedSwapRequest, requiresApproval: true };
      } else {
        // Efetiva a troca imediatamente
        const updatedShift = await tx.shift.update({
          where: { id: swapRequest.shiftId },
          data: {
            physiotherapistId: user.physiotherapistId!,
          },
        });

        const updatedSwapRequest = await tx.shiftSwapRequest.update({
          where: { id: swapRequestId },
          data: {
            status: 'ACCEPTED',
            responderId: user.physiotherapistId!,
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

        return { shift: updatedShift, swapRequest: updatedSwapRequest, requiresApproval: false };
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao aceitar solicitação de troca:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
