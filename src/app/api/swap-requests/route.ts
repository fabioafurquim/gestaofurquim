import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

const createSwapRequestSchema = z.object({
  shiftId: z.number(),
  targetPhysioId: z.number().optional().nullable(),
  reason: z.string().optional(),
});

/**
 * GET /api/swap-requests
 * Lista todas as solicitações de troca
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id;

    // Busca o fisioterapeuta vinculado ao usuário (se houver)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { physiotherapistId: true, role: true },
    });

    // Se for ADMIN ou MANAGER, mostra todas as trocas
    // Se for USER, mostra apenas trocas relacionadas ao seu fisioterapeuta
    const whereClause = user?.role === 'ADMIN' || user?.role === 'MANAGER'
      ? {}
      : user?.physiotherapistId
      ? {
          OR: [
            { requesterId: user.physiotherapistId },
            { targetPhysioId: user.physiotherapistId },
            { responderId: user.physiotherapistId },
            { targetPhysioId: null }, // Trocas abertas para todos
          ],
        }
      : { id: -1 }; // Não mostra nada se não tiver fisioterapeuta

    const swapRequests = await prisma.shiftSwapRequest.findMany({
      where: whereClause,
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(swapRequests);
  } catch (error) {
    console.error('Erro ao listar solicitações de troca:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/swap-requests
 * Cria uma nova solicitação de troca
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id;

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

    const body = await request.json();
    const validatedData = createSwapRequestSchema.parse(body);

    // Verifica se o plantão existe e pertence ao fisioterapeuta
    const shift = await prisma.shift.findUnique({
      where: { id: validatedData.shiftId },
      include: { shiftTeam: true },
    });

    if (!shift) {
      return NextResponse.json(
        { error: 'Plantão não encontrado' },
        { status: 404 }
      );
    }

    if (shift.physiotherapistId !== user.physiotherapistId) {
      return NextResponse.json(
        { error: 'Você não pode solicitar troca de um plantão que não é seu' },
        { status: 403 }
      );
    }

    // Verifica se já existe uma solicitação pendente para este plantão
    const existingRequest = await prisma.shiftSwapRequest.findFirst({
      where: {
        shiftId: validatedData.shiftId,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'Já existe uma solicitação de troca pendente para este plantão' },
        { status: 400 }
      );
    }

    // Cria a solicitação de troca
    const swapRequest = await prisma.shiftSwapRequest.create({
      data: {
        shiftId: validatedData.shiftId,
        requesterId: user.physiotherapistId,
        targetPhysioId: validatedData.targetPhysioId,
        reason: validatedData.reason,
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
      },
    });

    return NextResponse.json(swapRequest, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar solicitação de troca:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
