import { ShiftPeriod } from '@prisma/client';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth-helpers';
import { isHoliday, isWeekend } from '@/lib/date-utils';
import { prisma } from '@/lib/prisma';
import { getSlotDayTypeForDate } from '@/lib/shift-team-slots';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);

  try {
    const { error, user: currentUser } = await requireAuth();
    if (error) return error;

    if (currentUser.role === 'USER') {
      return NextResponse.json(
        { error: 'A alteração de plantões é exclusiva da gestão.' },
        { status: 403 }
      );
    }

    const data = await request.json();
    const { period, physiotherapistId, date, shiftTeamSlotId } = data as {
      period: ShiftPeriod;
      physiotherapistId: number | string;
      date?: string;
      shiftTeamSlotId?: number | string;
    };

    if (!period || !physiotherapistId) {
      return NextResponse.json({ error: 'Período e fisioterapeuta são obrigatórios' }, { status: 400 });
    }

    const existing = await prisma.shift.findUnique({
      where: { id },
      include: {
        shiftTeamSlot: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Plantão não encontrado' }, { status: 404 });
    }

    const targetDate = date
      ? (() => {
          const [year, month, day] = date.split('-').map(Number);
          return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        })()
      : existing.date;

    const physio = await prisma.physiotherapist.findUnique({
      where: { id: Number(physiotherapistId) },
      include: { teams: true },
    });

    if (!physio) {
      return NextResponse.json({ error: 'Fisioterapeuta inválido' }, { status: 400 });
    }

    const belongsToTeam = physio.teams.some((team) => team.shiftTeamId === existing.shiftTeamId);
    if (!belongsToTeam) {
      return NextResponse.json({ error: 'Fisioterapeuta não pertence à equipe selecionada' }, { status: 400 });
    }

    const isWeekendOrHoliday = isWeekend(targetDate) || (await isHoliday(targetDate));
    const slotDayType = getSlotDayTypeForDate(targetDate, isWeekendOrHoliday);
    const availableSlots = await prisma.shiftTeamSlot.findMany({
      where: {
        shiftTeamId: existing.shiftTeamId,
        period,
        dayType: slotDayType,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (availableSlots.length === 0) {
      return NextResponse.json({ error: 'Não há vagas configuradas para este período na equipe.' }, { status: 400 });
    }

    const occupiedSlots = await prisma.shift.findMany({
      where: {
        id: { not: id },
        shiftTeamId: existing.shiftTeamId,
        date: targetDate,
        period,
      },
      select: {
        shiftTeamSlotId: true,
      },
    });

    const occupiedSet = new Set(occupiedSlots.map((shift) => shift.shiftTeamSlotId));
    let targetSlotId = shiftTeamSlotId ? Number(shiftTeamSlotId) : existing.shiftTeamSlotId;

    if (!availableSlots.some((slot) => slot.id === targetSlotId)) {
      if (!shiftTeamSlotId) {
        const fallbackSlot = availableSlots.find((slot) => !occupiedSet.has(slot.id));
        if (!fallbackSlot) {
          return NextResponse.json({ error: 'Não há vaga disponível para este período/data.' }, { status: 400 });
        }
        targetSlotId = fallbackSlot.id;
      } else {
        return NextResponse.json({ error: 'A vaga selecionada não pertence a este período/equipe.' }, { status: 400 });
      }
    }

    if (occupiedSet.has(targetSlotId)) {
      return NextResponse.json({ error: 'Esta vaga já está ocupada na data selecionada.' }, { status: 409 });
    }

    const duplicate = await prisma.shift.findFirst({
      where: {
        id: { not: id },
        physiotherapistId: Number(physiotherapistId),
        date: targetDate,
        period,
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: 'Já existe um plantão para este fisioterapeuta nesta data e período.' },
        { status: 409 }
      );
    }

    const updatedShift = await prisma.shift.update({
      where: { id },
      data: {
        period,
        date: targetDate,
        physiotherapist: { connect: { id: Number(physiotherapistId) } },
        shiftTeamSlot: { connect: { id: targetSlotId } },
      },
    });

    return NextResponse.json({ message: 'Plantão atualizado com sucesso', shift: updatedShift });
  } catch (error) {
    console.error(`Erro ao atualizar plantão ${id}:`, error);
    return NextResponse.json({ error: 'Erro ao atualizar plantão' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await context.params;
  const id = parseInt(idStr, 10);

  try {
    const { error, user: currentUser } = await requireAuth();
    if (error) return error;

    if (currentUser.role === 'USER') {
      return NextResponse.json(
        { error: 'A exclusão de plantões é exclusiva da gestão.' },
        { status: 403 }
      );
    }

    const existingShift = await prisma.shift.findUnique({
      where: { id },
      select: {
        id: true,
        date: true,
        period: true,
        physiotherapistId: true,
        shiftTeamId: true,
        physiotherapist: {
          select: {
            name: true,
          },
        },
        shiftTeam: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!existingShift) {
      return NextResponse.json({ error: 'Plantão não encontrado' }, { status: 404 });
    }

    const deletionLog = await prisma.$transaction(async (tx) => {
      const createdLog = await tx.shiftDeletionLog.create({
        data: {
          originalShiftId: existingShift.id,
          shiftDate: existingShift.date,
          period: existingShift.period,
          shiftTeamId: existingShift.shiftTeamId,
          shiftTeamName: existingShift.shiftTeam.name,
          physiotherapistId: existingShift.physiotherapistId,
          physiotherapistName: existingShift.physiotherapist.name,
          deletedByUserId: Number(currentUser.id),
          deletedByUserName: currentUser.name,
          deletedByUserRole: currentUser.role,
          deletedOwnShift: false,
        },
      });

      await tx.shift.delete({
        where: { id },
      });

      return createdLog;
    });

    return NextResponse.json({ message: 'Plantão excluído com sucesso' }, { status: 200 });
  } catch (error) {
    console.error(`Erro ao excluir plantão ${id}:`, error);
    return NextResponse.json({ error: 'Erro ao excluir plantão' }, { status: 500 });
  }
}
