import { NextResponse } from 'next/server';
import fs from 'fs/promises';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { getBatchExportFile } from '@/lib/inter-payments';

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
    const exportFile = await getBatchExportFile(batchId);
    const fileBuffer = await fs.readFile(exportFile.filePath);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': exportFile.mimeType,
        'Content-Disposition': `attachment; filename="${exportFile.fileName}"`,
      },
    });
  } catch (error) {
    console.error('Erro ao baixar arquivo do lote:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao baixar arquivo do lote' },
      { status: 500 }
    );
  }
}
