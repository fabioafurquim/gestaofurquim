import { ShiftPeriod, ShiftTeamSlot } from '@prisma/client';

import { isHoliday, isWeekend } from './date-utils';
import { prisma } from './prisma';
import { getSlotDayTypeForDate } from './shift-team-slots';

export class ShiftCreationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ShiftCreationError';
    this.statusCode = statusCode;
  }
}

type PreferredSlot = Pick<ShiftTeamSlot, 'id' | 'description' | 'sortOrder' | 'shiftTeamId' | 'period'>;

export function parseShiftDate(value: string | Date) {
  const parsed =
    value instanceof Date
      ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12, 0, 0))
      : (() => {
          const [year, month, day] = value.split('-').map(Number);
          return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        })();

  if (Number.isNaN(parsed.getTime())) {
    throw new ShiftCreationError('Data inválida para criação do plantão.');
  }

  return parsed;
}

function toDateOnlyString(date: Date) {
  return date.toISOString().split('T')[0]!;
}

export async function validatePhysiotherapistForShift(
  physiotherapistId: number,
  shiftTeamId: number,
  shiftDate: Date
) {
  const physio = await prisma.physiotherapist.findUnique({
    where: { id: physiotherapistId },
    include: { teams: { where: { isActive: true } } },
  });

  if (!physio) {
    throw new ShiftCreationError('Fisioterapeuta inválido');
  }

  if (physio.status === 'INACTIVE' || (physio.exitDate && physio.exitDate <= shiftDate)) {
    throw new ShiftCreationError('Fisioterapeuta indisponível (inativo ou desligado para a data)');
  }

  const belongsToTeam = physio.teams.some((team) => team.shiftTeamId === shiftTeamId);
  if (!belongsToTeam) {
    throw new ShiftCreationError('Fisioterapeuta não pertence à equipe selecionada');
  }

  return physio;
}

async function resolveTargetSlot(
  shiftTeamId: number,
  period: ShiftPeriod,
  shiftDate: Date,
  explicitSlotId?: number,
  preferredSlot?: PreferredSlot
) {
  const isWeekendOrHoliday = isWeekend(shiftDate) || (await isHoliday(shiftDate));
  const slotDayType = getSlotDayTypeForDate(shiftDate, isWeekendOrHoliday);

  const shiftTeam = await prisma.shiftTeam.findUnique({
    where: { id: shiftTeamId },
    include: {
      shiftSlots: {
        where: {
          dayType: slotDayType,
          period,
          isActive: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!shiftTeam) {
    throw new ShiftCreationError('Equipe não encontrada');
  }

  if (shiftTeam.shiftSlots.length === 0) {
    throw new ShiftCreationError('Não há vagas configuradas para este período na equipe.');
  }

  const occupiedSlotIds = await prisma.shift.findMany({
    where: {
      date: shiftDate,
      period,
      shiftTeamId,
    },
    select: {
      shiftTeamSlotId: true,
    },
  });

  const occupiedSet = new Set(occupiedSlotIds.map((shift) => shift.shiftTeamSlotId));

  if (explicitSlotId) {
    const explicitSlot = shiftTeam.shiftSlots.find((slot) => slot.id === explicitSlotId);

    if (!explicitSlot) {
      throw new ShiftCreationError('A vaga selecionada não pertence a este período/equipe.');
    }

    if (occupiedSet.has(explicitSlotId)) {
      throw new ShiftCreationError('Esta vaga já está ocupada na data selecionada.', 409);
    }

    return explicitSlot.id;
  }

  if (preferredSlot) {
    const equivalentSlot =
      shiftTeam.shiftSlots.find((slot) => slot.id === preferredSlot.id) ??
      shiftTeam.shiftSlots.find(
        (slot) =>
          slot.sortOrder === preferredSlot.sortOrder && slot.description === preferredSlot.description
      ) ??
      shiftTeam.shiftSlots.find((slot) => slot.sortOrder === preferredSlot.sortOrder);

    if (!equivalentSlot) {
      throw new ShiftCreationError('Não há uma vaga equivalente configurada para uma das datas da recorrência.');
    }

    if (occupiedSet.has(equivalentSlot.id)) {
      throw new ShiftCreationError('A vaga equivalente já está ocupada em uma das datas da recorrência.', 409);
    }

    return equivalentSlot.id;
  }

  const firstAvailableSlot = shiftTeam.shiftSlots.find((slot) => !occupiedSet.has(slot.id));
  if (!firstAvailableSlot) {
    throw new ShiftCreationError('Não há mais vagas disponíveis para este período nesta data.');
  }

  return firstAvailableSlot.id;
}

export async function createSingleShift(params: {
  date: Date;
  period: ShiftPeriod;
  physiotherapistId: number;
  shiftTeamId: number;
  shiftTeamSlotId?: number;
  preferredSlot?: PreferredSlot;
}) {
  await validatePhysiotherapistForShift(params.physiotherapistId, params.shiftTeamId, params.date);

  const duplicate = await prisma.shift.findFirst({
    where: {
      physiotherapistId: params.physiotherapistId,
      date: params.date,
      period: params.period,
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ShiftCreationError('Já existe um plantão para este fisioterapeuta nesta data e período.', 409);
  }

  const targetSlotId = await resolveTargetSlot(
    params.shiftTeamId,
    params.period,
    params.date,
    params.shiftTeamSlotId,
    params.preferredSlot
  );

  return prisma.shift.create({
    data: {
      date: params.date,
      period: params.period,
      physiotherapist: { connect: { id: params.physiotherapistId } },
      shiftTeam: { connect: { id: params.shiftTeamId } },
      shiftTeamSlot: { connect: { id: targetSlotId } },
    },
  });
}

export async function getPreferredSlot(slotId: number) {
  const slot = await prisma.shiftTeamSlot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      description: true,
      sortOrder: true,
      shiftTeamId: true,
      period: true,
    },
  });

  if (!slot) {
    throw new ShiftCreationError('A vaga selecionada não foi encontrada.');
  }

  return slot;
}

export async function createRecurringWeeklyShifts(params: {
  startDate: Date;
  untilDate: Date;
  period: ShiftPeriod;
  physiotherapistId: number;
  shiftTeamId: number;
  preferredSlot: PreferredSlot;
  maxOccurrences?: number;
}) {
  return createRecurringShiftsByWeekdays({
    ...params,
    weekdays: [params.startDate.getUTCDay()],
  });
}

export async function createRecurringShiftsByWeekdays(params: {
  startDate: Date;
  untilDate: Date;
  weekdays: number[];
  period: ShiftPeriod;
  physiotherapistId: number;
  shiftTeamId: number;
  preferredSlot: PreferredSlot;
  maxOccurrences?: number;
}) {
  const created: Array<{ id: number; date: string }> = [];
  const skipped: Array<{ date: string; reason: string }> = [];
  const maxOccurrences = params.maxOccurrences ?? 366;
  const normalizedWeekdays = [...new Set(params.weekdays)]
    .map((weekday) => Number(weekday))
    .filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)
    .sort((left, right) => left - right);

  if (normalizedWeekdays.length === 0) {
    throw new ShiftCreationError('Selecione ao menos um dia da semana para a recorrência.');
  }

  let cursor = new Date(params.startDate);
  let occurrences = 0;

  while (cursor <= params.untilDate) {
    if (normalizedWeekdays.includes(cursor.getUTCDay())) {
      occurrences += 1;

      if (occurrences > maxOccurrences) {
        throw new ShiftCreationError(
          `A recorrência excede o limite de ${maxOccurrences} ocorrências nesta operação.`,
          400
        );
      }

      try {
        const shift = await createSingleShift({
          date: new Date(cursor),
          period: params.period,
          physiotherapistId: params.physiotherapistId,
          shiftTeamId: params.shiftTeamId,
          preferredSlot: params.preferredSlot,
        });

        created.push({
          id: shift.id,
          date: toDateOnlyString(cursor),
        });
      } catch (error) {
        const reason =
          error instanceof ShiftCreationError
            ? error.message
            : 'Falha inesperada ao criar uma ocorrência da recorrência.';

        skipped.push({
          date: toDateOnlyString(cursor),
          reason,
        });
      }
    }

    cursor = new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    created,
    skipped,
    requestedOccurrences: occurrences,
    weekdays: normalizedWeekdays,
  };
}
