import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import {
  ensureFinancialClosing,
  recordFinancialAuditEvent,
} from '@/lib/financial-closing';

interface RouteParams {
  params: Promise<{ month: string }>;
}

const auditSchema = z.object({
  type: z.enum([
    'SNAPSHOT_CREATED',
    'LINE_CREATED',
    'ADJUSTMENT_CREATED',
    'DOCUMENT_REGISTERED',
    'BATCH_CREATED',
    'BATCH_GENERATED',
    'STATUS_CHANGED',
    'PAYMENT_CONFIRMED',
    'REOPENED',
    'AUDIT_NOTE',
  ]).optional(),
  message: z.string().trim().min(1).max(1000),
  details: z.any().optional(),
  financialClosingLineId: z.number().int().positive().optional(),
  financialAdjustmentId: z.number().int().positive().optional(),
  financialDocumentId: z.number().int().positive().optional(),
  paymentBatchId: z.number().int().positive().optional(),
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
  const parsedBody = auditSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Dados invalidos para registrar a auditoria financeira.' },
      { status: 400 }
    );
  }

  const closing = await ensureFinancialClosing(month, {
    createdByUserId: getNumericUserId(user?.id),
  });

  const event = await recordFinancialAuditEvent({
    financialClosingId: closing.id,
    financialClosingLineId: parsedBody.data.financialClosingLineId ?? null,
    financialAdjustmentId: parsedBody.data.financialAdjustmentId ?? null,
    financialDocumentId: parsedBody.data.financialDocumentId ?? null,
    paymentBatchId: parsedBody.data.paymentBatchId ?? null,
    type: parsedBody.data.type ?? 'AUDIT_NOTE',
    actorUserId: getNumericUserId(user?.id),
    actorName: user?.name ?? null,
    message: parsedBody.data.message,
    details: parsedBody.data.details ?? null,
  });

  return NextResponse.json(event, {
    status: 201,
  });
}
