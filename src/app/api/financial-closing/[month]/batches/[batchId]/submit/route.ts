import { NextRequest, NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import {
  setPaymentBatchStatus,
  syncPaymentBatchReceiptsToClosing,
} from '@/lib/financial-closing';
import { submitFinancialBatch, toBatchSummary, toClientBatchManifest, loadFinancialBatch } from '@/lib/inter-payments';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ month: string; batchId: string }>;
}

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

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month, batchId } = await params;
  const manifest = await loadFinancialBatch(batchId);
  if (!manifest) {
    return NextResponse.json({ error: 'Lote nao encontrado.' }, { status: 404 });
  }

  const submitted = await submitFinancialBatch(batchId);
  const syncResult = await syncPaymentBatchReceiptsToClosing(
    month,
    batchId,
    getNumericUserId(user?.id)
  );

  const paymentBatch = await prisma.paymentBatch.findFirst({
    where: {
      batchNumber: batchId,
      financialClosing: {
        referenceMonth: month,
      },
    },
  });

  if (paymentBatch) {
    await setPaymentBatchStatus(
      paymentBatch.id,
      'SUBMITTED',
      getNumericUserId(user?.id),
      'Lote submetido ao Banco Inter.'
    );
  }

  return NextResponse.json({
    batch: toClientBatchManifest(submitted),
    summary: toBatchSummary(submitted),
    sync: syncResult,
  });
}
