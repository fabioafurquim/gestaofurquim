import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('[Test Prisma] Testando acesso aos campos do Telegram...');
    
    // Tentar buscar fisioterapeutas com campos do Telegram
    const physios = await prisma.physiotherapist.findMany({
      select: {
        id: true,
        name: true,
        telegramChatId: true,
        telegramUsername: true,
      },
      take: 5
    });

    console.log('[Test Prisma] Fisioterapeutas encontrados:', physios.length);
    
    return NextResponse.json({
      success: true,
      message: 'Prisma Client está funcionando corretamente',
      physiotherapists: physios,
      prismaClientVersion: require('@prisma/client/package.json').version,
    });
  } catch (error) {
    console.error('[Test Prisma] Erro:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'N/A',
      prismaClientVersion: require('@prisma/client/package.json').version,
    }, { status: 500 });
  }
}
