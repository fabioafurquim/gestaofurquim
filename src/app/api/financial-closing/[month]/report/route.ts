import { NextRequest, NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { getFinancialClosingSummary } from '@/lib/financial-closing';

interface RouteParams {
  params: Promise<{ month: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month } = await params;
  const report = await getFinancialClosingSummary(month);

  if (!report) {
    return NextResponse.json({ error: 'Fechamento nao encontrado.' }, { status: 404 });
  }

  return NextResponse.json(report);
}

