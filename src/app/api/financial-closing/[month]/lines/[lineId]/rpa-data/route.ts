import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { upsertManualFinancialRpaData } from '@/lib/financial-closing';

interface RouteParams {
  params: Promise<{ month: string; lineId: string }>;
}

const rpaManualSchema = z.object({
  valorServicoPrestado: z.number().min(0).optional(),
  outrosDescontos: z.number().min(0).optional(),
  iss: z.number().min(0).optional(),
  irrf: z.number().min(0).optional(),
  inss: z.number().min(0).optional(),
  totalDescontos: z.number().min(0).optional(),
  valorLiquido: z.number().min(0),
  applyToClosing: z.boolean().optional().default(true),
});

function normalizeUserId(userId: number | string | undefined | null) {
  if (typeof userId === 'string') {
    return Number.parseInt(userId, 10);
  }

  return userId ?? null;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month, lineId } = await params;
  const numericLineId = Number.parseInt(lineId, 10);

  if (!Number.isInteger(numericLineId)) {
    return NextResponse.json({ error: 'Linha invalida.' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsedBody = rpaManualSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Dados manuais da RPA invalidos.' }, { status: 400 });
  }

  try {
    const result = await upsertManualFinancialRpaData(month, numericLineId, {
      actorUserId: normalizeUserId(user?.id),
      rpaData: parsedBody.data,
      applyToClosing: parsedBody.data.applyToClosing,
    });

    return NextResponse.json({
      success: true,
      document: result.document,
      appliedToClosing: result.appliedToClosing,
      appliedAdjustment: result.appliedAdjustment,
    });
  } catch (routeError) {
    return NextResponse.json(
      { error: routeError instanceof Error ? routeError.message : 'Erro ao salvar os dados manuais da RPA.' },
      { status: 400 }
    );
  }
}
