import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import {
  createPaymentBatch,
  ensureFinancialClosing,
  setPaymentBatchStatus,
  syncPaymentBatchReceiptsToClosing,
} from '@/lib/financial-closing';
import {
  createAndPersistFinancialBatch,
  submitFinancialBatch,
} from '@/lib/inter-payments';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ month: string }>;
}

const batchSchema = z.object({
  provider: z.string().trim().max(80).optional(),
  batchNumber: z.string().trim().max(120).optional(),
  fileName: z.string().trim().max(255).optional(),
  fileId: z.string().trim().max(255).optional(),
  fileHash: z.string().trim().max(128).optional(),
  payload: z.any().optional(),
  includeZeroValues: z.boolean().optional(),
  submitNow: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
  filters: z
    .object({
      teamId: z.coerce.number().int().positive().optional(),
      physioId: z.coerce.number().int().positive().optional(),
    })
    .optional(),
});

function getNumericUserId(userId: string | number | undefined | null) {
  if (typeof userId === 'number') {
    return userId;
  }

  if (typeof userId === 'string') {
    const parsed = parseInt(userId, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireAdminOrManager();

  if (error) {
    return error;
  }

  const { month } = await params;
  const body = await request.json().catch(() => ({}));
  const parsedBody = batchSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Dados invalidos para gerar o lote bancario.' },
      { status: 400 }
    );
  }

  const closing = await ensureFinancialClosing(month, {
    createdByUserId: getNumericUserId(user?.id),
  });

  const paymentBatch = await createPaymentBatch({
    financialClosingId: closing.id,
    createdBy: getNumericUserId(user?.id),
    provider: parsedBody.data.provider ?? 'BANCO_INTER',
    batchNumber: parsedBody.data.batchNumber ?? null,
    fileName: parsedBody.data.fileName ?? null,
    fileId: parsedBody.data.fileId ?? null,
    fileHash: parsedBody.data.fileHash ?? null,
    payload: parsedBody.data.payload ?? null,
  });

  const transportBatch = await createAndPersistFinancialBatch({
    referenceMonth: month,
    filters: parsedBody.data.filters,
    includeZeroValues: parsedBody.data.includeZeroValues ?? false,
    notes: parsedBody.data.notes,
    createdBy: {
      id: getNumericUserId(user?.id) ?? undefined,
      name: user?.name || undefined,
      email: user?.email || undefined,
    },
  });

  const updatedPaymentBatch = await prisma.paymentBatch.update({
    where: { id: paymentBatch.id },
    data: {
      batchNumber: transportBatch.id,
      fileName: transportBatch.cnab?.fileName ?? paymentBatch.fileName,
      fileId: transportBatch.cnab?.filePath ?? paymentBatch.fileId,
      fileHash: transportBatch.cnab
        ? transportBatch.cnab.fileName
        : paymentBatch.fileHash,
      payload: {
        transportBatchId: transportBatch.id,
        transportStatus: transportBatch.status,
        transport: transportBatch.transport,
        referenceMonth: month,
      },
    },
  });

  let submittedTransportBatch = null;
  let syncResult = null;

  if (parsedBody.data.submitNow) {
    submittedTransportBatch = await submitFinancialBatch(transportBatch.id);

    await setPaymentBatchStatus(
      updatedPaymentBatch.id,
      'SUBMITTED',
      getNumericUserId(user?.id),
      'Lote submetido ao Banco Inter.'
    );

    syncResult = await syncPaymentBatchReceiptsToClosing(
      month,
      transportBatch.id,
      getNumericUserId(user?.id)
    );

    await setPaymentBatchStatus(
      updatedPaymentBatch.id,
      'CONFIRMED',
      getNumericUserId(user?.id),
      'Comprovantes sincronizados e fechamento conciliado.'
    );
  }

  return NextResponse.json(
    {
      paymentBatch: updatedPaymentBatch,
      transportBatch: submittedTransportBatch || transportBatch,
      sync: syncResult,
    },
    { status: 201 }
  );
}
