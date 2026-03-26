import { NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import {
  canManageHistoricalCorrection,
  createTeamPriceHistoryEntry,
  parseEffectiveFrom,
  previewTeamPriceHistoryImpact,
  serializeDecimalValue,
  serializePriceHistoryEntry,
  PriceHistoryError,
} from '@/lib/price-history';
import { prisma } from '@/lib/prisma';

function getUserId(user: { id: string | number }) {
  return typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminOrManager();
  if (error) return error;

  const { id } = await context.params;
  const teamId = parseInt(id, 10);

  if (Number.isNaN(teamId)) {
    return NextResponse.json({ error: 'Equipe inválida.' }, { status: 400 });
  }

  const team = await prisma.shiftTeam.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      shiftValue: true,
      createdAt: true,
      priceHistory: {
        include: {
          user: { select: { name: true } },
          updatedByUser: { select: { name: true } },
        },
        orderBy: [
          { effectiveFrom: 'desc' },
          { id: 'desc' },
        ],
      },
    },
  });

  if (!team) {
    return NextResponse.json({ error: 'Equipe não encontrada.' }, { status: 404 });
  }

  const now = new Date();
  const currentEntry = team.priceHistory.find((entry) => entry.effectiveFrom <= now) ?? null;
  const nextEntry = [...team.priceHistory]
    .filter((entry) => entry.effectiveFrom > now)
    .sort((left, right) => left.effectiveFrom.getTime() - right.effectiveFrom.getTime())[0] ?? null;

  return NextResponse.json({
    team: {
      id: team.id,
      name: team.name,
      currentShiftValue: serializeDecimalValue(team.shiftValue) ?? 0,
      currentHistoryId: currentEntry?.id ?? null,
      nextScheduledValue: nextEntry ? serializeDecimalValue(nextEntry.shiftValue) : null,
      nextScheduledFrom: nextEntry?.effectiveFrom.toISOString() ?? null,
      createdAt: team.createdAt.toISOString(),
    },
    history: team.priceHistory.map((entry) => ({
      ...serializePriceHistoryEntry(entry),
      shiftValue: serializeDecimalValue(entry.shiftValue),
      isCurrent: currentEntry?.id === entry.id,
      isFuture: entry.effectiveFrom > now,
    })),
    latestImpact: currentEntry ? await previewTeamPriceHistoryImpact(teamId, currentEntry.id) : null,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAdminOrManager();
  if (error) return error;

  const { id } = await context.params;
  const teamId = parseInt(id, 10);

  if (Number.isNaN(teamId)) {
    return NextResponse.json({ error: 'Equipe inválida.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const shiftValue = Number(body.shiftValue);
    const effectiveFrom = parseEffectiveFrom(body.effectiveFrom);
    const changeReason =
      typeof body.changeReason === 'string' ? body.changeReason.trim() : '';

    if (!Number.isFinite(shiftValue) || shiftValue < 0) {
      return NextResponse.json({ error: 'Valor do plantão inválido.' }, { status: 400 });
    }

    if (!changeReason) {
      return NextResponse.json({ error: 'Informe o motivo da alteração.' }, { status: 400 });
    }

    if (!canManageHistoricalCorrection(user!.role, effectiveFrom)) {
      return NextResponse.json(
        { error: 'Somente administradores podem lançar ou corrigir vigências retroativas.' },
        { status: 403 }
      );
    }

    const created = await prisma.$transaction(async (tx) =>
      createTeamPriceHistoryEntry(tx, {
        shiftTeamId: teamId,
        shiftValue,
        effectiveFrom,
        createdBy: getUserId(user!),
        changeReason,
      })
    );

    return NextResponse.json({
      message: 'Histórico de valor registrado com sucesso.',
      history: {
        ...serializePriceHistoryEntry(created),
        shiftValue: serializeDecimalValue(created.shiftValue),
      },
    });
  } catch (error) {
    console.error('Erro ao criar histórico de valor da equipe:', error);

    if (error instanceof PriceHistoryError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.statusCode });
    }

    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
