import { NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { submitClosingBankBatch } from '@/lib/financial-closing-bank';

function normalizeUserId(userId: number | string | undefined | null) {
  if (typeof userId === 'string') {
    return Number.parseInt(userId, 10);
  }

  return userId ?? null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ month: string; batchId: string }> }
) {
  const { error, user } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  try {
    const { month, batchId } = await params;
    const payload = await submitClosingBankBatch(month, batchId, {
      id: normalizeUserId(user?.id),
      name: user?.name ?? null,
    });

    return NextResponse.json(payload);
  } catch (routeError) {
    return NextResponse.json(
      { error: routeError instanceof Error ? routeError.message : 'Erro ao submeter lote bancário.' },
      { status: 400 }
    );
  }
}
