import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { getBatchReceiptFile, loadFinancialBatch } from '@/lib/inter-payments';

interface RouteParams {
  params: Promise<{ month: string; batchId: string; receiptId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month, batchId, receiptId } = await params;
  const batch = await loadFinancialBatch(batchId);

  if (!batch || batch.referenceMonth !== month) {
    return NextResponse.json({ error: 'Lote nao encontrado.' }, { status: 404 });
  }

  const file = await getBatchReceiptFile(batchId, receiptId);
  const buffer = await fs.readFile(file.filePath);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
    },
  });
}
