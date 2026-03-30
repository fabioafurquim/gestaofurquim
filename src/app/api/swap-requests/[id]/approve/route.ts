import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

class SwapApprovalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SwapApprovalValidationError';
  }
}

/**
 * PATCH /api/swap-requests/[id]/approve
 * Aprova uma solicitação de troca (ADMIN ou MANAGER)
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

    // Apenas ADMIN e MANAGER podem aprovar
    if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'Apenas administradores e gestores podem aprovar trocas' },
        { status: 403 }
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
            physiotherapist: true,
          },
        },
        requester: true,
        responder: true,
      },
    });

    if (!swapRequest) {
      return NextResponse.json(
        { error: 'Solicitação de troca não encontrada' },
        { status: 404 }
      );
    }

    // Verifica se está aguardando aprovação
    if (swapRequest.status !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { error: 'Esta solicitação não está aguardando aprovação' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentSwapRequest = await tx.shiftSwapRequest.findUnique({
        where: { id: swapRequestId },
        include: {
          shift: true,
        },
      });

      if (!currentSwapRequest || currentSwapRequest.status !== 'PENDING_APPROVAL') {
        throw new SwapApprovalValidationError('Esta solicitação não está mais aguardando aprovação.');
      }

      if (!currentSwapRequest.responderId) {
        throw new SwapApprovalValidationError('A solicitação não possui um fisioterapeuta respondente válido.');
      }

      if (currentSwapRequest.shift.physiotherapistId !== currentSwapRequest.requesterId) {
        throw new SwapApprovalValidationError(
          'O plantão original foi alterado após o aceite. Revise a escala antes de aprovar esta troca.'
        );
      }

      const responderStillInTeam = await tx.physiotherapistTeam.findFirst({
        where: {
          physiotherapistId: currentSwapRequest.responderId,
          shiftTeamId: currentSwapRequest.shift.shiftTeamId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!responderStillInTeam) {
        throw new SwapApprovalValidationError(
          'O fisioterapeuta que aceitou a troca não está mais ativo nesta equipe.'
        );
      }

      const conflictingShift = await tx.shift.findFirst({
        where: {
          id: { not: currentSwapRequest.shiftId },
          physiotherapistId: currentSwapRequest.responderId,
          date: currentSwapRequest.shift.date,
          period: currentSwapRequest.shift.period,
        },
        select: { id: true },
      });

      if (conflictingShift) {
        throw new SwapApprovalValidationError(
          'O fisioterapeuta que aceitou a troca passou a ter conflito neste dia e período.'
        );
      }

      // Atualiza o plantão para o novo fisioterapeuta
      const updatedShift = await tx.shift.update({
        where: { id: currentSwapRequest.shiftId },
        data: {
          physiotherapistId: currentSwapRequest.responderId,
        },
      });

      // Atualiza a solicitação de troca
      const updatedSwapRequest = await tx.shiftSwapRequest.update({
        where: { id: currentSwapRequest.id },
        data: {
          status: 'ACCEPTED',
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

      return { shift: updatedShift, swapRequest: updatedSwapRequest };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SwapApprovalValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    console.error('Erro ao aprovar solicitação de troca:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
