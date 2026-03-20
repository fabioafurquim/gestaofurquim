import { ShiftPeriod } from '@prisma/client';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import {
  buildTeamSlotPayloadFromLegacyCounts,
  normalizeTeamSlotPayload,
} from '@/lib/shift-team-slots';
import { buildTeamSlotCounts, syncTeamSlots } from '@/lib/team-slot-sync';
import { validateSlotReduction } from '@/lib/validations';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const team = await prisma.shiftTeam.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        shiftSlots: {
          where: { isActive: true },
          orderBy: [{ dayType: 'asc' }, { period: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 });
    }

    return NextResponse.json(team);
  } catch (error) {
    console.error('Erro ao buscar equipe:', error);
    return NextResponse.json({ error: 'Erro ao buscar equipe' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await context.params;
  const teamId = parseInt(id, 10);
  const data = await request.json();
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const shiftValue = Number(data.shiftValue ?? 0);
  const slotPayload = data.slots
    ? normalizeTeamSlotPayload(data.slots)
    : buildTeamSlotPayloadFromLegacyCounts(data);
  const nextCounts = buildTeamSlotCounts(slotPayload);

  if (!name) {
    return NextResponse.json({ error: 'Nome da equipe é obrigatório' }, { status: 400 });
  }

  try {
    const currentTeam = await prisma.shiftTeam.findUnique({
      where: { id: teamId },
      include: {
        shiftSlots: {
          where: { isActive: true },
        },
      },
    });

    if (!currentTeam) {
      return NextResponse.json({ error: 'Equipe não encontrada' }, { status: 404 });
    }

    const validationErrors: string[] = [];
    const validationDetails: Array<{ period: ShiftPeriod; dayType: 'weekday' | 'weekend'; conflicts?: unknown }> = [];

    const validations = [
      {
        period: 'MORNING' as ShiftPeriod,
        weekday: nextCounts.weekdayMorningSlots,
        weekend: nextCounts.weekendMorningSlots,
        currentWeekday: currentTeam.weekdayMorningSlots,
        currentWeekend: currentTeam.weekendMorningSlots,
      },
      {
        period: 'INTERMEDIATE' as ShiftPeriod,
        weekday: nextCounts.weekdayIntermediateSlots,
        weekend: nextCounts.weekendIntermediateSlots,
        currentWeekday: currentTeam.weekdayIntermediateSlots,
        currentWeekend: currentTeam.weekendIntermediateSlots,
      },
      {
        period: 'AFTERNOON' as ShiftPeriod,
        weekday: nextCounts.weekdayAfternoonSlots,
        weekend: nextCounts.weekendAfternoonSlots,
        currentWeekday: currentTeam.weekdayAfternoonSlots,
        currentWeekend: currentTeam.weekendAfternoonSlots,
      },
      {
        period: 'NIGHT' as ShiftPeriod,
        weekday: nextCounts.weekdayNightSlots,
        weekend: nextCounts.weekendNightSlots,
        currentWeekday: currentTeam.weekdayNightSlots,
        currentWeekend: currentTeam.weekendNightSlots,
      },
    ];

    for (const validation of validations) {
      if (validation.weekday < validation.currentWeekday) {
        const result = await validateSlotReduction(teamId, validation.period, validation.weekday, 'weekday');
        if (!result.isValid) {
          validationErrors.push(result.message || 'Erro ao validar redução de vagas em dias úteis');
          validationDetails.push({
            period: validation.period,
            dayType: 'weekday',
            conflicts: result.conflicts,
          });
        }
      }

      if (validation.weekend < validation.currentWeekend) {
        const result = await validateSlotReduction(teamId, validation.period, validation.weekend, 'weekend');
        if (!result.isValid) {
          validationErrors.push(result.message || 'Erro ao validar redução de vagas em fins de semana e feriados');
          validationDetails.push({
            period: validation.period,
            dayType: 'weekend',
            conflicts: result.conflicts,
          });
        }
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Não é possível reduzir as vagas',
          details: validationErrors,
          conflicts: validationDetails,
        },
        { status: 400 }
      );
    }

    const valueChanged = shiftValue !== Number(currentTeam.shiftValue);

    const updatedTeam = await prisma.$transaction(async (tx) => {
      await tx.shiftTeam.update({
        where: { id: teamId },
        data: {
          name,
          shiftValue,
          ...nextCounts,
        },
      });

      await syncTeamSlots(tx, teamId, slotPayload);

      if (valueChanged && shiftValue > 0 && session) {
        const userId = typeof session.user.id === 'string' ? parseInt(session.user.id, 10) : session.user.id;

        await tx.shiftTeamPriceHistory.create({
          data: {
            shiftTeamId: teamId,
            shiftValue,
            effectiveFrom: new Date(),
            createdBy: userId,
          },
        });
      }

      return tx.shiftTeam.findUniqueOrThrow({
        where: { id: teamId },
        include: {
          shiftSlots: {
            where: { isActive: true },
            orderBy: [{ dayType: 'asc' }, { period: 'asc' }, { sortOrder: 'asc' }],
          },
        },
      });
    });

    return NextResponse.json(updatedTeam);
  } catch (error) {
    console.error('Erro ao atualizar equipe:', error);
    return NextResponse.json({ error: 'Erro ao atualizar equipe' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await context.params;
  const teamId = parseInt(id, 10);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureShiftsCount = await prisma.shift.count({
      where: {
        shiftTeamId: teamId,
        date: {
          gte: today,
        },
      },
    });

    if (futureShiftsCount > 0) {
      const futureShifts = await prisma.shift.findMany({
        where: {
          shiftTeamId: teamId,
          date: {
            gte: today,
          },
        },
        include: {
          physiotherapist: {
            select: { name: true },
          },
        },
        orderBy: {
          date: 'asc',
        },
        take: 10,
      });

      return NextResponse.json(
        {
          error: 'Não é possível excluir equipe com plantões futuros',
          message: `Esta equipe possui ${futureShiftsCount} plantão(ões) futuro(s) agendado(s). Remova ou realoque estes plantões antes de excluir a equipe.`,
          futureShiftsCount,
          shifts: futureShifts.map((shift) => ({
            id: shift.id,
            date: new Date(shift.date).toLocaleDateString('pt-BR'),
            period: shift.period,
            physiotherapist: shift.physiotherapist.name,
          })),
        },
        { status: 400 }
      );
    }

    await prisma.shiftTeam.delete({
      where: { id: teamId },
    });

    return NextResponse.json({ message: 'Equipe excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir equipe:', error);
    return NextResponse.json({ error: 'Erro ao excluir equipe' }, { status: 500 });
  }
}
