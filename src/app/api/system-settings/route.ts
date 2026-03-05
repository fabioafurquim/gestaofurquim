import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

const updateSettingsSchema = z.object({
  swapRequiresApproval: z.boolean(),
});

/**
 * GET /api/system-settings
 * Retorna as configurações do sistema
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

    // Busca ou cria as configurações
    let settings = await prisma.systemSettings.findFirst();

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          swapRequiresApproval: true,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/system-settings
 * Atualiza as configurações do sistema (apenas ADMIN)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem alterar configurações.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateSettingsSchema.parse(body);

    // Busca ou cria as configurações
    let settings = await prisma.systemSettings.findFirst();

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: validatedData,
      });
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: validatedData,
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);

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
