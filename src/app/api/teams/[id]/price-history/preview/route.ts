import { NextResponse } from 'next/server';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import {
  canManageHistoricalCorrection,
  parseEffectiveFrom,
  previewTeamPriceHistoryImpactForCandidate,
  PriceHistoryError,
} from '@/lib/price-history';

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
    const effectiveFrom = parseEffectiveFrom(body.effectiveFrom);
    const excludedHistoryId = body.historyId ? Number(body.historyId) : undefined;

    if (!canManageHistoricalCorrection(user!.role, effectiveFrom)) {
      return NextResponse.json(
        { error: 'Somente administradores podem simular vigências retroativas.' },
        { status: 403 }
      );
    }

    const preview = await previewTeamPriceHistoryImpactForCandidate(
      teamId,
      effectiveFrom,
      excludedHistoryId
    );

    return NextResponse.json({
      ...preview,
      startDate: preview.startDate.toISOString(),
      endDate: preview.endDate?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('Erro ao gerar preview do histórico da equipe:', error);

    if (error instanceof PriceHistoryError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.statusCode });
    }

    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
