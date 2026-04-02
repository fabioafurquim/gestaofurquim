import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import {
  createAndPersistFinancialBatch,
  listFinancialBatches,
  submitFinancialBatch,
  toClientBatchManifest,
  toBatchSummary,
} from '@/lib/inter-payments';

export const runtime = 'nodejs';

const createBatchSchema = z.object({
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  includeZeroValues: z.boolean().optional(),
  submitNow: z.boolean().optional(),
  notes: z.string().optional(),
  filters: z
    .object({
      teamId: z.coerce.number().int().positive().optional(),
      physioId: z.coerce.number().int().positive().optional(),
    })
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireAdminOrManager();
    if (error) {
      return error;
    }

    const { searchParams } = new URL(request.url);
    const referenceMonth = searchParams.get('referenceMonth');
    const batches = await listFinancialBatches();

    const filtered = referenceMonth
      ? batches.filter((batch) => batch.referenceMonth === referenceMonth)
      : batches;

    return NextResponse.json({
      batches: filtered,
    });
  } catch (error) {
    console.error('Erro ao listar lotes financeiros:', error);
    return NextResponse.json(
      { error: 'Erro ao listar lotes financeiros' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error, user } = await requireAdminOrManager();
    if (error) {
      return error;
    }

    const body = await request.json();
    const parsed = createBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Dados invalidos para gerar lote financeiro',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const manifest = await createAndPersistFinancialBatch({
      referenceMonth: parsed.data.referenceMonth,
      filters: parsed.data.filters,
      includeZeroValues: parsed.data.includeZeroValues ?? false,
      notes: parsed.data.notes,
      createdBy: {
        id: user?.id,
        name: user?.name || undefined,
        email: user?.email || undefined,
      },
    });

    if (parsed.data.submitNow) {
      const submitted = await submitFinancialBatch(manifest.id);
      return NextResponse.json({
        batch: toClientBatchManifest(submitted),
        summary: toBatchSummary(submitted),
      });
    }

    return NextResponse.json({
      batch: toClientBatchManifest(manifest),
      summary: toBatchSummary(manifest),
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar lote financeiro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar lote financeiro' },
      { status: 500 }
    );
  }
}
