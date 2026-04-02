import { NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { ensureFinancialClosing } from '@/lib/financial-closing';
import { generateRpaGrossValuesPdf } from '@/lib/financial-rpa-pdf';

interface RouteParams {
  params: Promise<{ month: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { error } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month } = await params;
  const closing = await ensureFinancialClosing(month);
  const pdfBytes = await generateRpaGrossValuesPdf({
    referenceMonth: month,
    lines: closing.lines,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="RPA_Brutos_${month}.pdf"`,
    },
  });
}
