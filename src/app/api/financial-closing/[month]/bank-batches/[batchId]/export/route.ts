import fs from 'fs/promises';
import { NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { downloadClosingBankExport } from '@/lib/financial-closing-bank';

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
    const exportFile = await downloadClosingBankExport(batchId, month);
    const fileBuffer = await fs.readFile(exportFile.filePath);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': exportFile.mimeType,
        'Content-Disposition': `attachment; filename="${exportFile.fileName}"`,
      },
    });
  } catch (routeError) {
    return NextResponse.json(
      { error: routeError instanceof Error ? routeError.message : 'Erro ao baixar arquivo do lote.' },
      { status: 400 }
    );
  }
}
