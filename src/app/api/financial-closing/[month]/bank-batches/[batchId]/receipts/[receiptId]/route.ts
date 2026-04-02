import fs from 'fs/promises';
import { NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { downloadClosingBankReceipt } from '@/lib/financial-closing-bank';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ month: string; batchId: string; receiptId: string }> }
) {
  const { error } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  try {
    const { month, batchId, receiptId } = await params;
    const receipt = await downloadClosingBankReceipt(batchId, receiptId, month);
    const fileBuffer = await fs.readFile(receipt.filePath);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': receipt.mimeType,
        'Content-Disposition': `attachment; filename="${receipt.fileName}"`,
      },
    });
  } catch (routeError) {
    return NextResponse.json(
      { error: routeError instanceof Error ? routeError.message : 'Erro ao baixar comprovante.' },
      { status: 400 }
    );
  }
}
