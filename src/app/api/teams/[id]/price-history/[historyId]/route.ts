import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth-helpers';
import {
  parseEffectiveFrom,
  previewTeamPriceHistoryImpact,
  serializeDecimalValue,
  serializePriceHistoryEntry,
  updateTeamPriceHistoryEntry,
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
  const teamId = parseInt(id, 10);
  const parsedHistoryId = parseInt(historyId, 10);

  if (Number.isNaN(teamId) || Number.isNaN(parsedHistoryId)) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
  }

  try {
    const existingHistory = await prisma.shiftTeamPriceHistory.findUnique({
      where: { id: parsedHistoryId },
      select: { shiftTeamId: true },
    });

    if (!existingHistory || existingHistory.shiftTeamId !== teamId) {
      return NextResponse.json({ error: 'Histórico não encontrado para esta equipe.' }, { status: 404 });
    }

    const body = await request.json();
    const shiftValue = Number(body.shiftValue);
    const effectiveFrom = parseEffectiveFrom(body.effectiveFrom);
    const changeReason =
      typeof body.changeReason === 'string' ? body.changeReason.trim() : '';

    if (!Number.isFinite(shiftValue) || shiftValue < 0) {
      return NextResponse.json({ error: 'Valor do plantão inválido.' }, { status: 400 });
    }

    if (!changeReason) {
      return NextResponse.json({ error: 'Informe o motivo da correção.' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) =>
      updateTeamPriceHistoryEntry(tx, {
        historyId: parsedHistoryId,
        shiftValue,
        effectiveFrom,
        updatedBy: getUserId(user!),
        changeReason,
      })
    );

    return NextResponse.json({
      message: 'Histórico corrigido com sucesso.',
      history: {
        ...serializePriceHistoryEntry(updated),
        shiftValue: serializeDecimalValue(updated.shiftValue),
      },
      impact: await previewTeamPriceHistoryImpact(teamId, parsedHistoryId),
    });
  } catch (error) {
    console.error('Erro ao atualizar histórico de valor da equipe:', error);

    if (error instanceof PriceHistoryError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.statusCode });
    }

    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
