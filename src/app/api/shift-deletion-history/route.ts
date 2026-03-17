import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrManager } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  const { error } = await requireAdminOrManager();
  if (error) return error;

  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '100');

    const logs = await prisma.shiftDeletionLog.findMany({
      take: Number.isNaN(limit) ? 100 : Math.min(limit, 200),
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(logs);
  } catch (routeError) {
    console.error('Erro ao buscar histÃ³rico de exclusÃµes:', routeError);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
