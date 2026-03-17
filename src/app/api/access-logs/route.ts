import { NextRequest, NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const searchParams = request.nextUrl.searchParams;
  const days = Number(searchParams.get('days') || '30');
  const limit = Number(searchParams.get('limit') || '200');

  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 30;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 200;
  const since = subDays(new Date(), safeDays);

  try {
    const logs = await prisma.userAccessLog.findMany({
      where: {
        loggedInAt: {
          gte: since,
        },
      },
      orderBy: {
        loggedInAt: 'desc',
      },
      take: safeLimit,
    });

    return NextResponse.json(logs);
  } catch (fetchError) {
    console.error('Erro ao buscar logs de acesso:', fetchError);
    return NextResponse.json({ error: 'Erro ao carregar logs de acesso' }, { status: 500 });
  }
}
