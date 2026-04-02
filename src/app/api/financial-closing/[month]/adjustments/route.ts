import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { ensureFinancialClosing, registerFinancialAdjustment } from '@/lib/financial-closing';

interface RouteParams {
  params: Promise<{ month: string }>;
}

const adjustmentSchema = z.object({
  financialClosingLineId: z.number().int().positive().optional(),
  type: z.enum(['BONUS', 'CREDIT', 'DEBIT', 'DISCOUNT', 'CORRECTION', 'OTHER']),
  amount: z.number().finite().refine((value) => value !== 0, {
    message: 'O valor do ajuste precisa ser diferente de zero.',
  }),
  reason: z.string().trim().min(3).max(500),
  description: z.string().trim().max(2000).optional(),
});

function normalizeUserId(userId: number | string | undefined | null) {
  if (typeof userId === 'string') {
    return Number.parseInt(userId, 10);
  }

  return userId ?? null;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month } = await params;

  const body = await request.json().catch(() => ({}));
  const parsedBody = adjustmentSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Dados invalidos para criar o ajuste financeiro.' },
      { status: 400 }
    );
  }

  const closing = await ensureFinancialClosing(month, {
    createdByUserId: normalizeUserId(user?.id),
  });

  const adjustment = await registerFinancialAdjustment({
    financialClosingId: closing.id,
    financialClosingLineId: parsedBody.data.financialClosingLineId ?? null,
    type: parsedBody.data.type,
    amount: parsedBody.data.amount,
    reason: parsedBody.data.reason,
    description: parsedBody.data.description ?? null,
    createdBy: normalizeUserId(user?.id),
    source: 'MANUAL',
  });

  return NextResponse.json(adjustment, { status: 201 });
}
