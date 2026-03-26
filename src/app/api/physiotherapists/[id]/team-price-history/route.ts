import { NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import {
  canManageHistoricalCorrection,
  createCustomPriceHistoryEntry,
  parseEffectiveFrom,
  previewCustomPriceHistoryImpact,
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
  const physiotherapistId = parseInt(id, 10);

  if (Number.isNaN(physiotherapistId)) {
    return NextResponse.json({ error: 'Fisioterapeuta inválido.' }, { status: 400 });
  }

  const physiotherapist = await prisma.physiotherapist.findUnique({
    where: { id: physiotherapistId },
    select: {
      id: true,
      name: true,
      teams: {
        where: { isActive: true },
        include: {
          shiftTeam: {
            select: {
              id: true,
              name: true,
              shiftValue: true,
            },
          },
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
        orderBy: {
          shiftTeam: { name: 'asc' },
        },
      },
    },
  });

  if (!physiotherapist) {
    return NextResponse.json({ error: 'Fisioterapeuta não encontrado.' }, { status: 404 });
  }

  const now = new Date();

  return NextResponse.json({
    physiotherapist: {
      id: physiotherapist.id,
      name: physiotherapist.name,
    },
    assignments: await Promise.all(
      physiotherapist.teams.map(async (assignment) => {
        const currentEntry = assignment.priceHistory.find((entry) => entry.effectiveFrom <= now) ?? null;
        const nextEntry = [...assignment.priceHistory]
          .filter((entry) => entry.effectiveFrom > now)
          .sort((left, right) => left.effectiveFrom.getTime() - right.effectiveFrom.getTime())[0] ?? null;

        return {
          physiotherapistTeamId: assignment.id,
          shiftTeamId: assignment.shiftTeamId,
          teamName: assignment.shiftTeam.name,
          teamDefaultValue: serializeDecimalValue(assignment.shiftTeam.shiftValue) ?? 0,
          currentCustomValue: serializeDecimalValue(assignment.customShiftValue),
          currentHistoryId: currentEntry?.id ?? null,
          nextScheduledValue: nextEntry ? serializeDecimalValue(nextEntry.customShiftValue) : null,
          nextScheduledFrom: nextEntry?.effectiveFrom.toISOString() ?? null,
          history: assignment.priceHistory.map((entry) => ({
            ...serializePriceHistoryEntry(entry),
            customShiftValue: serializeDecimalValue(entry.customShiftValue),
            isCurrent: currentEntry?.id === entry.id,
            isFuture: entry.effectiveFrom > now,
          })),
          latestImpact: currentEntry
            ? {
                ...(await previewCustomPriceHistoryImpact(assignment.id, currentEntry.id)),
              }
            : null,
        };
      })
    ),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAdminOrManager();
  if (error) return error;

  const { id } = await context.params;
  const physiotherapistId = parseInt(id, 10);

  if (Number.isNaN(physiotherapistId)) {
    return NextResponse.json({ error: 'Fisioterapeuta inválido.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const shiftTeamId = Number(body.shiftTeamId);
    const effectiveFrom = parseEffectiveFrom(body.effectiveFrom);
    const customShiftValue =
      body.customShiftValue === null || body.customShiftValue === ''
        ? null
        : Number(body.customShiftValue);
    const changeReason =
      typeof body.changeReason === 'string' ? body.changeReason.trim() : '';

    if (!Number.isInteger(shiftTeamId) || shiftTeamId <= 0) {
      return NextResponse.json({ error: 'Equipe inválida.' }, { status: 400 });
    }

    if (customShiftValue !== null && (!Number.isFinite(customShiftValue) || customShiftValue < 0)) {
      return NextResponse.json({ error: 'Valor customizado inválido.' }, { status: 400 });
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

    const assignment = await prisma.physiotherapistTeam.findFirst({
      where: {
        physiotherapistId,
        shiftTeamId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Vínculo ativo com a equipe não encontrado.' }, { status: 404 });
    }

    const created = await prisma.$transaction(async (tx) =>
      createCustomPriceHistoryEntry(tx, {
        physiotherapistTeamId: assignment.id,
        customShiftValue,
        effectiveFrom,
        createdBy: getUserId(user!),
        changeReason,
      })
    );

    return NextResponse.json({
      message: 'Histórico customizado registrado com sucesso.',
      history: {
        ...serializePriceHistoryEntry(created),
        customShiftValue: serializeDecimalValue(created.customShiftValue),
      },
    });
  } catch (error) {
    console.error('Erro ao criar histórico customizado:', error);

    if (error instanceof PriceHistoryError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.statusCode });
    }

    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
