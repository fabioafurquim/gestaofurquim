import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth-helpers';
import {
  parseEffectiveFrom,
  previewCustomPriceHistoryImpact,
  serializeDecimalValue,
  serializePriceHistoryEntry,
  updateCustomPriceHistoryEntry,
  PriceHistoryError,
} from '@/lib/price-history';
import { prisma } from '@/lib/prisma';

function getUserId(user: { id: string | number }) {
  return typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; historyId: string }> }
) {
  const { error, user } = await requireAdmin();
  if (error) return error;

  const { id, historyId } = await context.params;
  const physiotherapistId = parseInt(id, 10);
  const parsedHistoryId = parseInt(historyId, 10);

  if (Number.isNaN(physiotherapistId) || Number.isNaN(parsedHistoryId)) {
    return NextResponse.json({ error: 'Histórico inválido.' }, { status: 400 });
  }

  try {
    const existingHistory = await prisma.physiotherapistTeamPriceHistory.findUnique({
      where: { id: parsedHistoryId },
      select: {
        physiotherapistTeam: {
          select: {
            physiotherapistId: true,
          },
        },
      },
    });

    if (!existingHistory || existingHistory.physiotherapistTeam.physiotherapistId !== physiotherapistId) {
      return NextResponse.json({ error: 'Histórico não encontrado para este fisioterapeuta.' }, { status: 404 });
    }

    const body = await request.json();
    const customShiftValue =
      body.customShiftValue === null || body.customShiftValue === ''
        ? null
        : Number(body.customShiftValue);
    const effectiveFrom = parseEffectiveFrom(body.effectiveFrom);
    const changeReason =
      typeof body.changeReason === 'string' ? body.changeReason.trim() : '';

    if (customShiftValue !== null && (!Number.isFinite(customShiftValue) || customShiftValue < 0)) {
      return NextResponse.json({ error: 'Valor customizado inválido.' }, { status: 400 });
    }

    if (!changeReason) {
      return NextResponse.json({ error: 'Informe o motivo da correção.' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) =>
      updateCustomPriceHistoryEntry(tx, {
        historyId: parsedHistoryId,
        customShiftValue,
        effectiveFrom,
        updatedBy: getUserId(user!),
        changeReason,
      })
    );

    return NextResponse.json({
      message: 'Histórico customizado corrigido com sucesso.',
      history: {
        ...serializePriceHistoryEntry(updated),
        customShiftValue: serializeDecimalValue(updated.customShiftValue),
      },
      impact: await previewCustomPriceHistoryImpact(updated.physiotherapistTeamId, parsedHistoryId),
    });
  } catch (error) {
    console.error('Erro ao atualizar histórico customizado:', error);

    if (error instanceof PriceHistoryError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.statusCode });
    }

    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
