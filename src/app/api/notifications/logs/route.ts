import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const logs = await prisma.notificationLog.findMany({
      take: limit,
      orderBy: { sentAt: 'desc' },
      include: {
        physiotherapist: {
          select: {
            name: true,
          },
        },
      },
      where: {
        messageType: 'daily_reminder',
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
