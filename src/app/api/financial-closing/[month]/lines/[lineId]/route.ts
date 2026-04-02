import { FinancialClosingLineStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { updateFinancialClosingLineStatus } from '@/lib/financial-closing';

interface RouteParams {
  params: Promise<{ month: string; lineId: string }>;
}

function normalizeUserId(userId: number | string | undefined | null) {
  if (typeof userId === 'string') {
    return Number.parseInt(userId, 10);
  }

  return userId ?? null;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month, lineId } = await params;

  try {
    const body = await request.json();
    const status = body?.status as FinancialClosingLineStatus | undefined;
    const message = typeof body?.message === 'string' ? body.message : undefined;
    const numericLineId = Number.parseInt(lineId, 10);

    if (!Number.isInteger(numericLineId) || !status || !Object.values(FinancialClosingLineStatus).includes(status)) {
      return NextResponse.json({ error: 'Atualizacao de linha invalida.' }, { status: 400 });
    }

    const updatedLine = await updateFinancialClosingLineStatus(
      month,
      numericLineId,
      status,
      normalizeUserId(user?.id),
      message ?? null
    );

    return NextResponse.json(updatedLine);
  } catch (routeError) {
    return NextResponse.json(
      { error: routeError instanceof Error ? routeError.message : 'Erro ao atualizar linha do fechamento.' },
      { status: 400 }
    );
  }
}
