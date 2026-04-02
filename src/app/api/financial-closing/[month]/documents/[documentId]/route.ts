import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { syncFinancialRpaDocument } from '@/lib/financial-closing';

interface RouteParams {
  params: Promise<{ month: string; documentId: string }>;
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

  const { month, documentId } = await params;
  const numericDocumentId = Number.parseInt(documentId, 10);

  if (!Number.isInteger(numericDocumentId)) {
    return NextResponse.json({ error: 'Documento invalido.' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsedBody = rpaManualSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Dados manuais da RPA invalidos.' }, { status: 400 });
  }

  const document = await prisma.financialDocument.findFirst({
    where: {
      id: numericDocumentId,
      referenceMonth: month,
      type: 'RPA',
    },
    select: {
      id: true,
    },
  });

  if (!document) {
    return NextResponse.json({ error: 'Documento RPA nao encontrado para esta competencia.' }, { status: 404 });
  }

  try {
    const result = await syncFinancialRpaDocument(document.id, {
      actorUserId: normalizeUserId(user?.id),
      rpaData: parsedBody.data,
      parserStatus: 'MANUAL_CONFIRMED',
      parserMessage: 'Valores da RPA preenchidos manualmente.',
      manualOverride: true,
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
      { error: routeError instanceof Error ? routeError.message : 'Erro ao atualizar os dados da RPA.' },
      { status: 400 }
    );
  }
}
