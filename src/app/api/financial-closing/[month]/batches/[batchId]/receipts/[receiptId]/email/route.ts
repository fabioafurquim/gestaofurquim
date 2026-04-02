import { NextRequest, NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { sendFinancialBatchReceiptEmail } from '@/lib/financial-closing';

interface RouteParams {
  params: Promise<{ month: string; batchId: string; receiptId: string }>;
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

  const { month, batchId, receiptId } = await params;
  const result = await sendFinancialBatchReceiptEmail(
    month,
    batchId,
    receiptId,
    getNumericUserId(user?.id)
  );

  return NextResponse.json(result);
}
