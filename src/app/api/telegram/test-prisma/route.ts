import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const linkedCount = await prisma.physiotherapist.count({
      where: {
        OR: [
          { telegramChatId: { not: null } },
          { telegramUsername: { not: null } },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Prisma Client está funcionando corretamente',
      linkedTelegramAccounts: linkedCount,
      prismaClientVersion: Prisma.prismaVersion.client,
    });
  } catch (error) {
    console.error('[Test Prisma] Erro:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      prismaClientVersion: Prisma.prismaVersion.client,
    }, { status: 500 });
  }
}
