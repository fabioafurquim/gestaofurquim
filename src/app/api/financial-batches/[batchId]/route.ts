import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { loadFinancialBatch, toBatchSummary, toClientBatchManifest } from '@/lib/inter-payments';

export const runtime = 'nodejs';

const updateBatchSchema = z.object({
  notes: z.string().optional(),
  status: z.enum(['DRAFT', 'READY_FOR_SUBMISSION', 'SUBMITTED', 'SYNCED', 'COMPLETED', 'FAILED']).optional(),
});

export async function GET(
  request: NextRequest,
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
      batch: toClientBatchManifest(batch),
      summary: toBatchSummary(batch),
    });
  } catch (error) {
    console.error('Erro ao carregar lote financeiro:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar lote financeiro' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
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

    const body = await request.json();
    const parsed = updateBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Dados invalidos para atualizar lote',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = {
      ...batch,
      notes: parsed.data.notes ?? batch.notes,
      status: parsed.data.status ?? batch.status,
      updatedAt: new Date().toISOString(),
    };

    const { writeFile, mkdir } = await import('fs/promises');
    const path = await import('path');
    const rootMatch = batch.id.match(/^FB-(\d{4})(\d{2})-/);

    if (!rootMatch) {
      return NextResponse.json({ error: 'ID de lote invalido' }, { status: 400 });
    }

    const batchDir = path.join(
      process.cwd(),
      'data',
      'financial-batches',
      `${rootMatch[1]}-${rootMatch[2]}`,
      batch.id
    );

    await mkdir(batchDir, { recursive: true });
    await writeFile(path.join(batchDir, 'manifest.json'), JSON.stringify(updated, null, 2), 'utf-8');

    return NextResponse.json({
      batch: toClientBatchManifest(updated),
      summary: toBatchSummary(updated),
    });
  } catch (error) {
    console.error('Erro ao atualizar lote financeiro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar lote financeiro' },
      { status: 500 }
    );
  }
}
