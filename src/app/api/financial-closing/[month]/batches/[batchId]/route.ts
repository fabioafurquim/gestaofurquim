import { NextRequest, NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { loadFinancialBatch, toBatchSummary, toClientBatchManifest } from '@/lib/inter-payments';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ month: string; batchId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month, batchId } = await params;
  const transportBatch = await loadFinancialBatch(batchId);

  const paymentBatch = await prisma.paymentBatch.findFirst({
    where: {
      batchNumber: batchId,
      financialClosing: {
        referenceMonth: month,
      },
    },
    include: {
      financialClosing: {
        select: {
          id: true,
          referenceMonth: true,
          status: true,
          totalNetValue: true,
        },
      },
      lines: {
        select: {
          id: true,
          physiotherapistId: true,
          physiotherapistName: true,
          netValue: true,
          status: true,
        },
      },
    },
  });

  if (!paymentBatch && !transportBatch) {
    return NextResponse.json({ error: 'Lote nao encontrado.' }, { status: 404 });
  }

  return NextResponse.json({
    paymentBatch,
    transportBatch: transportBatch ? toClientBatchManifest(transportBatch) : null,
    transportSummary: transportBatch ? toBatchSummary(transportBatch) : null,
  });
}
