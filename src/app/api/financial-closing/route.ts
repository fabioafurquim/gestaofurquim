import { NextRequest, NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { ensureFinancialClosing, getFinancialClosingByMonth } from '@/lib/financial-closing';
import { prisma } from '@/lib/prisma';

function normalizeUserId(userId: number | string | undefined | null) {
  if (typeof userId === 'string') {
    return Number.parseInt(userId, 10);
  }

  return userId ?? null;
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const referenceMonth = request.nextUrl.searchParams.get('referenceMonth');

  if (referenceMonth) {
    const closing = await getFinancialClosingByMonth(referenceMonth);

    if (!closing) {
      return NextResponse.json({ error: 'Fechamento nao encontrado.' }, { status: 404 });
    }

    return NextResponse.json(closing);
  }

  const closings = await prisma.financialClosing.findMany({
    orderBy: [
      { year: 'desc' },
      { month: 'desc' },
    ],
    include: {
      _count: {
        select: {
          lines: true,
          adjustments: true,
          documents: true,
          paymentBatches: true,
          auditEvents: true,
        },
      },
    },
  });

  return NextResponse.json({ closings });
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  try {
    const body = await request.json();
    const referenceMonth = body?.referenceMonth;

    if (typeof referenceMonth !== 'string') {
      return NextResponse.json({ error: 'Competencia invalida.' }, { status: 400 });
    }

    const closing = await ensureFinancialClosing(referenceMonth, {
      createdByUserId: normalizeUserId(user?.id),
      notes: typeof body?.notes === 'string' ? body.notes : undefined,
      force: Boolean(body?.force),
    });

    return NextResponse.json(closing, { status: 201 });
  } catch (routeError) {
    return NextResponse.json(
      { error: routeError instanceof Error ? routeError.message : 'Erro ao gerar fechamento financeiro.' },
      { status: 400 }
    );
  }
}
