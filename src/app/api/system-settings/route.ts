import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const updateSettingsSchema = z.object({
  swapRequiresApproval: z.boolean(),
});

function serializeSystemSettings(settings: {
  id: number;
  swapRequiresApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: settings.id,
    swapRequiresApproval: settings.swapRequiresApproval,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

async function ensureSystemSettings() {
  let settings = await prisma.systemSettings.findFirst({
    select: {
      id: true,
      swapRequiresApproval: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: {
        swapRequiresApproval: true,
      },
      select: {
        id: true,
        swapRequiresApproval: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  return settings;
}

/**
 * GET /api/system-settings
 * Retorna apenas as configuracoes publicas e seguras do sistema.
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Nao autenticado' },
        { status: 401 }
      );
    }

    const settings = await ensureSystemSettings();

    return NextResponse.json(serializeSystemSettings(settings));
  } catch (error) {
    console.error('Erro ao buscar configuracoes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/system-settings
 * Atualiza as configuracoes publicas do sistema (apenas ADMIN).
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem alterar configuracoes.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateSettingsSchema.parse(body);
    const settings = await ensureSystemSettings();

    const updatedSettings = await prisma.systemSettings.update({
      where: { id: settings.id },
      data: validatedData,
      select: {
        id: true,
        swapRequiresApproval: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(serializeSystemSettings(updatedSettings));
  } catch (error) {
    console.error('Erro ao atualizar configuracoes:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
