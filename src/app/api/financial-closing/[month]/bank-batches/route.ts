import { NextRequest, NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { createClosingBankBatch, listClosingBankBatches } from '@/lib/financial-closing-bank';

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
  const batches = await listClosingBankBatches(month);

  return NextResponse.json({ batches });
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  try {
    const { month } = await params;
    const payload = await createClosingBankBatch(month, {
      id: normalizeUserId(user?.id),
      name: user?.name ?? null,
      email: user?.email ?? null,
    });

    return NextResponse.json(payload, { status: 201 });
  } catch (routeError) {
    return NextResponse.json(
      { error: routeError instanceof Error ? routeError.message : 'Erro ao gerar lote bancário.' },
      { status: 400 }
    );
  }
}
