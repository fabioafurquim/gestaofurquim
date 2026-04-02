import { NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { getClosingBankBatch } from '@/lib/financial-closing-bank';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ month: string; batchId: string }> }
) {
  const { error } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  try {
    const { month, batchId } = await params;
    const payload = await getClosingBankBatch(batchId, month);
    return NextResponse.json({
      batchId: payload.batch.id,
      referenceMonth: payload.batch.referenceMonth,
      receipts: payload.receipts,
    });
  } catch (routeError) {
    return NextResponse.json(
      { error: routeError instanceof Error ? routeError.message : 'Erro ao listar comprovantes do lote.' },
      { status: 400 }
    );
  }
}
