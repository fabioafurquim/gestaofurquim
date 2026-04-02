import { NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { loadFinancialBatch, toClientBatchReceipt } from '@/lib/inter-payments';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { error } = await requireAdminOrManager();
    if (error) {
      return error;
    }

    const { batchId } = await params;
    const batch = await loadFinancialBatch(batchId);

    if (!batch) {
      return NextResponse.json({ error: 'Lote nao encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      batchId: batch.id,
      referenceMonth: batch.referenceMonth,
      receipts: batch.receipts.map(toClientBatchReceipt),
    });
  } catch (error) {
    console.error('Erro ao listar comprovantes do lote:', error);
    return NextResponse.json(
      { error: 'Erro ao listar comprovantes do lote' },
      { status: 500 }
    );
  }
}
