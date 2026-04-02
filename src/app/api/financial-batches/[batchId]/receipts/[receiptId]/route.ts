import { NextResponse } from 'next/server';
import fs from 'fs/promises';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { loadFinancialBatch } from '@/lib/inter-payments';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string; receiptId: string }> }
) {
  try {
    const { error } = await requireAdminOrManager();
    if (error) {
      return error;
    }

    const { batchId, receiptId } = await params;
    const batch = await loadFinancialBatch(batchId);

    if (!batch) {
      return NextResponse.json({ error: 'Lote nao encontrado' }, { status: 404 });
    }

    const receipt = batch.receipts.find((item) => item.receiptId === receiptId);

    if (!receipt || !receipt.filePath) {
      return NextResponse.json({ error: 'Comprovante nao encontrado' }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(receipt.filePath);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': receipt.mimeType || 'application/pdf',
        'Content-Disposition': `attachment; filename="${receipt.fileName}"`,
      },
    });
  } catch (error) {
    console.error('Erro ao baixar comprovante do lote:', error);
    return NextResponse.json(
      { error: 'Erro ao baixar comprovante do lote' },
      { status: 500 }
    );
  }
}
