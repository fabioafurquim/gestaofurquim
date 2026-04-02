import { NextRequest, NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { loadFinancialBatch, toClientBatchReceipt } from '@/lib/inter-payments';

interface RouteParams {
  params: Promise<{ month: string; batchId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month, batchId } = await params;
  const batch = await loadFinancialBatch(batchId);

  if (!batch || batch.referenceMonth !== month) {
    return NextResponse.json({ error: 'Lote nao encontrado.' }, { status: 404 });
  }

  return NextResponse.json({
    batchId: batch.id,
    referenceMonth: batch.referenceMonth,
    receipts: batch.receipts.map(toClientBatchReceipt),
    total: batch.receipts.length,
  });
}
