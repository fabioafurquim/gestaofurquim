import { NextRequest, NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import {
  ensureFinancialClosing,
  getFinancialClosingByMonth,
  updateFinancialClosingStatus,
} from '@/lib/financial-closing';

interface RouteParams {
  params: Promise<{ month: string }>;
}

function normalizeUserId(userId: number | string | undefined | null) {
  if (typeof userId === 'string') {
    return Number.parseInt(userId, 10);
  }

  return userId ?? null;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month } = await params;
  const closing = await getFinancialClosingByMonth(month);

  if (!closing) {
    return NextResponse.json({ error: 'Fechamento nao encontrado.' }, { status: 404 });
  }

  return NextResponse.json(closing);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const closing = await ensureFinancialClosing(month, {
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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month } = await params;

  try {
    const body = await request.json();
    const status = typeof body?.status === 'string' ? body.status : null;
    const message = typeof body?.message === 'string' ? body.message : undefined;

    if (!status) {
      return NextResponse.json({ error: 'Status invalido.' }, { status: 400 });
    }

    const updated = await updateFinancialClosingStatus(
      month,
      status as never,
      normalizeUserId(user?.id),
      user?.name ?? null,
      message ?? null
    );

    return NextResponse.json(updated);
  } catch (routeError) {
    return NextResponse.json(
      { error: routeError instanceof Error ? routeError.message : 'Erro ao atualizar fechamento financeiro.' },
      { status: 400 }
    );
  }
}
