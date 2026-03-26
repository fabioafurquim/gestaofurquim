import { NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import {
  canManageHistoricalCorrection,
  parseEffectiveFrom,
  previewCustomPriceHistoryImpactForCandidate,
  PriceHistoryError,
} from '@/lib/price-history';
import { prisma } from '@/lib/prisma';

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
    const excludedHistoryId = body.historyId ? Number(body.historyId) : undefined;

    if (!Number.isInteger(shiftTeamId) || shiftTeamId <= 0) {
      return NextResponse.json({ error: 'Equipe inválida.' }, { status: 400 });
    }

    if (!canManageHistoricalCorrection(user!.role, effectiveFrom)) {
      return NextResponse.json(
        { error: 'Somente administradores podem simular vigências retroativas.' },
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

    const preview = await previewCustomPriceHistoryImpactForCandidate(
      assignment.id,
      effectiveFrom,
      excludedHistoryId
    );

    return NextResponse.json({
      ...preview,
      startDate: preview.startDate.toISOString(),
      endDate: preview.endDate?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('Erro ao gerar preview do histórico customizado:', error);

    if (error instanceof PriceHistoryError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.statusCode });
    }

    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
