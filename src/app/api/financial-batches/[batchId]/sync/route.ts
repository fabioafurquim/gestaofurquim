import { NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { syncFinancialBatch, toBatchSummary, toClientBatchManifest } from '@/lib/inter-payments';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { error } = await requireAdminOrManager();
    if (error) {
      return error;
    }

    const { batchId } = await params;
    const batch = await syncFinancialBatch(batchId);

    return NextResponse.json({
      batch: toClientBatchManifest(batch),
      summary: toBatchSummary(batch),
    });
  } catch (error) {
    console.error('Erro ao sincronizar lote financeiro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao sincronizar lote financeiro' },
      { status: 500 }
    );
  }
}
