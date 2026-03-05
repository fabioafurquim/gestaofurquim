import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

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

    // Efetiva a troca usando uma transação
    const result = await prisma.$transaction(async (tx) => {
      // Atualiza o plantão para o novo fisioterapeuta
      const updatedShift = await tx.shift.update({
        where: { id: swapRequest.shiftId },
        data: {
          physiotherapistId: swapRequest.responderId!,
        },
      });

      // Atualiza a solicitação de troca
      const updatedSwapRequest = await tx.shiftSwapRequest.update({
        where: { id: swapRequestId },
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
    console.error('Erro ao aprovar solicitação de troca:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
