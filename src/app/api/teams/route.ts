import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import {
  buildTeamSlotPayloadFromLegacyCounts,
  normalizeTeamSlotPayload,
} from '@/lib/shift-team-slots';
import { buildTeamSlotCounts, createTeamSlots } from '@/lib/team-slot-sync';

export async function GET() {
  try {
    const teams = await prisma.shiftTeam.findMany({
      orderBy: { name: 'asc' },
      include: {
        shiftSlots: {
          where: { isActive: true },
          orderBy: [{ dayType: 'asc' }, { period: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    });

    return NextResponse.json(teams);
  } catch (error) {
    console.error('Erro ao buscar equipes:', error);
    return NextResponse.json({ error: 'Erro ao buscar equipes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error, user } = await requireAuth();
  if (error) return error;

  const data = await request.json();
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const shiftValue = Number(data.shiftValue ?? 0);
  const slotPayload = data.slots
    ? normalizeTeamSlotPayload(data.slots)
    : buildTeamSlotPayloadFromLegacyCounts(data);

  if (!name) {
    return NextResponse.json({ error: 'Nome da equipe é obrigatório' }, { status: 400 });
  }

  try {
    const team = await prisma.$transaction(async (tx) => {
      const createdTeam = await tx.shiftTeam.create({
        data: {
          name,
          shiftValue,
          ...buildTeamSlotCounts(slotPayload),
        },
      });

      await createTeamSlots(tx, createdTeam.id, slotPayload);

      await tx.shiftTeamPriceHistory.create({
        data: {
          shiftTeamId: createdTeam.id,
          shiftValue,
          effectiveFrom: new Date(),
          createdBy: user ? (typeof user.id === 'string' ? parseInt(user.id, 10) : user.id) : null,
          updatedBy: user ? (typeof user.id === 'string' ? parseInt(user.id, 10) : user.id) : null,
          changeReason: 'Valor inicial da equipe',
        },
      });

      return tx.shiftTeam.findUniqueOrThrow({
        where: { id: createdTeam.id },
        include: {
          shiftSlots: {
            where: { isActive: true },
            orderBy: [{ dayType: 'asc' }, { period: 'asc' }, { sortOrder: 'asc' }],
          },
        },
      });
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar equipe:', error);
    return NextResponse.json({ error: 'Erro ao criar equipe' }, { status: 500 });
  }
}
