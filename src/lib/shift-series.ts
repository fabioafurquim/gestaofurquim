import {
  Prisma,
  Shift,
  ShiftPeriod,
  ShiftSeries,
  ShiftSeriesExceptionType,
  ShiftSeriesStatus,
  UserRole,
} from '@prisma/client';

import { isHoliday, isWeekend } from './date-utils';
import { prisma } from './prisma';
import {
  PreferredSlot,
  ShiftCreationError,
  getPreferredSlot,
  toDateOnlyString,
  validateShiftDuplicate,
} from './shift-creation';
import { getSlotDayTypeForDate } from './shift-team-slots';

type Tx = Prisma.TransactionClient;

export type ShiftSeriesScope = 'THIS' | 'THIS_AND_FUTURE' | 'ALL';

export type ActingUser = {
  id: number;
  name: string;
  role: UserRole;
};

type SeriesMutationInput = {
  physiotherapistId: number;
  period: ShiftPeriod;
  shiftTeamId: number;
  shiftTeamSlotId: number;
  endDate: Date;
  weekdays: number[];
};

type SyncSummary = {
  created: Array<{ id: number; date: string }>;
  updated: Array<{ id: number; date: string }>;
  deleted: Array<{ id: number; date: string }>;
  skipped: Array<{ date: string; reason: string }>;
};

type SeriesWithRelations = ShiftSeries & {
  shiftTeamSlot: {
    id: number;
    description: string;
    sortOrder: number;
    shiftTeamId: number;
    period: ShiftPeriod;
  };
};

function normalizeWeekdays(weekdays: number[]) {
  const normalized = [...new Set(weekdays)]
    .map((weekday) => Number(weekday))
    .filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)
    .sort((left, right) => left - right);

  if (normalized.length === 0) {
    throw new ShiftCreationError('Selecione ao menos um dia da semana para a recorrência.');
  }

  return normalized;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function subtractDays(date: Date, days: number) {
  return addDays(date, -days);
}

function maxDate(left: Date, right: Date) {
  return left > right ? left : right;
}

function minDate(left: Date, right: Date) {
  return left < right ? left : right;
}

function isDateWithinRange(date: Date, startDate: Date, endDate: Date) {
  return date >= startDate && date <= endDate;
}

function isDateIncludedBySeries(date: Date, series: Pick<ShiftSeries, 'startDate' | 'endDate' | 'weekdays'>) {
  return isDateWithinRange(date, series.startDate, series.endDate) && series.weekdays.includes(date.getUTCDay());
}

async function fetchSeriesOrThrow(tx: Tx, seriesId: number) {
  const series = await tx.shiftSeries.findUnique({
    where: { id: seriesId },
    include: {
      shiftTeamSlot: {
        select: {
          id: true,
          description: true,
          sortOrder: true,
          shiftTeamId: true,
          period: true,
        },
      },
    },
  });

  if (!series) {
    throw new ShiftCreationError('Série recorrente não encontrada.', 404);
  }

  return series as SeriesWithRelations;
}

async function validatePhysiotherapistAssignment(
  tx: Tx,
  physiotherapistId: number,
  shiftTeamId: number,
  date: Date
) {
  const physio = await tx.physiotherapist.findUnique({
    where: { id: physiotherapistId },
    include: {
      teams: {
        where: { isActive: true },
      },
    },
  });

  if (!physio) {
    throw new ShiftCreationError('Fisioterapeuta inválido');
  }

  if (physio.status === 'INACTIVE' || (physio.exitDate && physio.exitDate <= date)) {
    throw new ShiftCreationError('Fisioterapeuta indisponível (inativo ou desligado para a data)');
  }

  const belongsToTeam = physio.teams.some((team) => team.shiftTeamId === shiftTeamId);
  if (!belongsToTeam) {
    throw new ShiftCreationError('Fisioterapeuta não pertence à equipe selecionada');
  }

  return physio;
}

async function resolveSeriesSlotId(
  tx: Tx,
  params: {
    shiftTeamId: number;
    period: ShiftPeriod;
    date: Date;
    explicitSlotId?: number;
    preferredSlot?: PreferredSlot;
    ignoreShiftId?: number;
  }
) {
  const isWeekendOrHoliday = isWeekend(params.date) || (await isHoliday(params.date));
  const slotDayType = getSlotDayTypeForDate(params.date, isWeekendOrHoliday);

  const shiftTeam = await tx.shiftTeam.findUnique({
    where: { id: params.shiftTeamId },
    include: {
      shiftSlots: {
        where: {
          dayType: slotDayType,
          period: params.period,
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

  const occupiedSlotIds = await tx.shift.findMany({
    where: {
      ...(params.ignoreShiftId ? { id: { not: params.ignoreShiftId } } : {}),
      shiftTeamId: params.shiftTeamId,
      date: params.date,
      period: params.period,
    },
    select: {
      shiftTeamSlotId: true,
    },
  });

  const occupiedSet = new Set(occupiedSlotIds.map((shift) => shift.shiftTeamSlotId));

  if (params.explicitSlotId) {
    const explicitSlot = shiftTeam.shiftSlots.find((slot) => slot.id === params.explicitSlotId);

    if (!explicitSlot) {
      throw new ShiftCreationError('A vaga selecionada não pertence a este período/equipe.');
    }

    if (occupiedSet.has(explicitSlot.id)) {
      throw new ShiftCreationError('Esta vaga já está ocupada na data selecionada.', 409);
    }

    return explicitSlot.id;
  }

  if (params.preferredSlot) {
    const equivalentSlot =
      shiftTeam.shiftSlots.find((slot) => slot.id === params.preferredSlot!.id) ??
      shiftTeam.shiftSlots.find(
        (slot) =>
          slot.sortOrder === params.preferredSlot!.sortOrder &&
          slot.description === params.preferredSlot!.description
      ) ??
      shiftTeam.shiftSlots.find((slot) => slot.sortOrder === params.preferredSlot!.sortOrder);

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

async function validateSeriesBaseSlot(
  shiftTeamId: number,
  period: ShiftPeriod,
  shiftTeamSlotId: number
) {
  const slot = await getPreferredSlot(shiftTeamSlotId);

  if (slot.shiftTeamId !== shiftTeamId || slot.period !== period) {
    throw new ShiftCreationError('A vaga base da série não pertence à equipe/período selecionados.');
  }

  return slot;
}

async function createDeletionLogs(
  tx: Tx,
  shifts: Array<{
    id: number;
    date: Date;
    period: ShiftPeriod;
    shiftTeamId: number;
    physiotherapistId: number;
    shiftTeam: { name: string };
    physiotherapist: { name: string };
  }>,
  actingUser: ActingUser
) {
  if (shifts.length === 0) {
    return;
  }

  await tx.shiftDeletionLog.createMany({
    data: shifts.map((shift) => ({
      originalShiftId: shift.id,
      shiftDate: shift.date,
      period: shift.period,
      shiftTeamId: shift.shiftTeamId,
      shiftTeamName: shift.shiftTeam.name,
      physiotherapistId: shift.physiotherapistId,
      physiotherapistName: shift.physiotherapist.name,
      deletedByUserId: actingUser.id,
      deletedByUserName: actingUser.name,
      deletedByUserRole: actingUser.role,
      deletedOwnShift: false,
    })),
  });
}

async function deleteShiftsWithLogs(
  tx: Tx,
  shifts: Array<{
    id: number;
    date: Date;
    period: ShiftPeriod;
    shiftTeamId: number;
    physiotherapistId: number;
    shiftTeam: { name: string };
    physiotherapist: { name: string };
  }>,
  actingUser: ActingUser
) {
  if (shifts.length === 0) {
    return;
  }

  await createDeletionLogs(tx, shifts, actingUser);
  await tx.shift.deleteMany({
    where: {
      id: {
        in: shifts.map((shift) => shift.id),
      },
    },
  });
}

async function upsertSeriesException(
  tx: Tx,
  params: {
    shiftSeriesId: number;
    occurrenceDate: Date;
    type: ShiftSeriesExceptionType;
    shiftId?: number | null;
  }
) {
  return tx.shiftSeriesException.upsert({
    where: {
      shiftSeriesId_occurrenceDate: {
        shiftSeriesId: params.shiftSeriesId,
        occurrenceDate: params.occurrenceDate,
      },
    },
    update: {
      type: params.type,
      shiftId: params.shiftId ?? null,
    },
    create: {
      shiftSeriesId: params.shiftSeriesId,
      occurrenceDate: params.occurrenceDate,
      type: params.type,
      shiftId: params.shiftId ?? null,
    },
  });
}

async function clearSeriesException(tx: Tx, shiftSeriesId: number, occurrenceDate: Date) {
  await tx.shiftSeriesException.deleteMany({
    where: {
      shiftSeriesId,
      occurrenceDate,
    },
  });
}

async function applySingleShiftMutation(
  tx: Tx,
  params: {
    shift: Shift & { shiftSeries: ShiftSeries | null };
    physiotherapistId: number;
    period: ShiftPeriod;
    date: Date;
    shiftTeamId: number;
    shiftTeamSlotId?: number;
    preferredSlot?: PreferredSlot;
  }
) {
  await validatePhysiotherapistAssignment(tx, params.physiotherapistId, params.shiftTeamId, params.date);
  await validateShiftDuplicate({
    physiotherapistId: params.physiotherapistId,
    date: params.date,
    period: params.period,
    ignoreShiftId: params.shift.id,
  });

  const targetSlotId = await resolveSeriesSlotId(tx, {
    shiftTeamId: params.shiftTeamId,
    period: params.period,
    date: params.date,
    explicitSlotId: params.shiftTeamSlotId,
    preferredSlot: params.preferredSlot,
    ignoreShiftId: params.shift.id,
  });

  return tx.shift.update({
    where: { id: params.shift.id },
    data: {
      date: params.date,
      period: params.period,
      physiotherapistId: params.physiotherapistId,
      shiftTeamId: params.shiftTeamId,
      shiftTeamSlotId: targetSlotId,
    },
  });
}

async function pruneSeriesFromDate(
  tx: Tx,
  seriesId: number,
  fromDate: Date,
  actingUser: ActingUser
) {
  const shiftsToDelete = await tx.shift.findMany({
    where: {
      shiftSeriesId: seriesId,
      date: {
        gte: fromDate,
      },
    },
    include: {
      physiotherapist: {
        select: { name: true },
      },
      shiftTeam: {
        select: { name: true },
      },
    },
  });

  await deleteShiftsWithLogs(tx, shiftsToDelete, actingUser);
  await tx.shiftSeriesException.deleteMany({
    where: {
      shiftSeriesId: seriesId,
      occurrenceDate: {
        gte: fromDate,
      },
    },
  });
}

async function pruneSeriesAfterEndDate(
  tx: Tx,
  seriesId: number,
  endDate: Date,
  actingUser: ActingUser
) {
  const cutoffDate = addDays(endDate, 1);
  await pruneSeriesFromDate(tx, seriesId, cutoffDate, actingUser);
}

async function syncSeriesRange(
  tx: Tx,
  params: {
    seriesId: number;
    fromDate?: Date;
    untilDate?: Date;
    actingUser: ActingUser;
  }
): Promise<SyncSummary> {
  const series = await fetchSeriesOrThrow(tx, params.seriesId);
  const preferredSlot = series.shiftTeamSlot;
  const startDate = params.fromDate ? maxDate(params.fromDate, series.startDate) : series.startDate;
  const endDate = params.untilDate ? minDate(params.untilDate, series.endDate) : series.endDate;

  if (startDate > endDate) {
    return { created: [], updated: [], deleted: [], skipped: [] };
  }

  const existingShifts = await tx.shift.findMany({
    where: {
      shiftSeriesId: series.id,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const exceptions = await tx.shiftSeriesException.findMany({
    where: {
      shiftSeriesId: series.id,
      occurrenceDate: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const existingByDate = new Map(existingShifts.map((shift) => [toDateOnlyString(shift.date), shift] as const));
  const exceptionByDate = new Map(exceptions.map((exception) => [toDateOnlyString(exception.occurrenceDate), exception] as const));

  const created: SyncSummary['created'] = [];
  const updated: SyncSummary['updated'] = [];
  const deleted: SyncSummary['deleted'] = [];
  const skipped: SyncSummary['skipped'] = [];
  const desiredDates = new Set<string>();

  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    if (series.weekdays.includes(cursor.getUTCDay())) {
      const occurrenceDate = new Date(cursor);
      const dateKey = toDateOnlyString(occurrenceDate);
      desiredDates.add(dateKey);

      const existingShift = existingByDate.get(dateKey);
      const exception = exceptionByDate.get(dateKey);

      if (exception?.type === 'SKIP') {
        if (existingShift && !existingShift.isSeriesException) {
          const shiftsToDelete = await tx.shift.findMany({
            where: { id: existingShift.id },
            include: {
              physiotherapist: { select: { name: true } },
              shiftTeam: { select: { name: true } },
            },
          });
          await deleteShiftsWithLogs(tx, shiftsToDelete, params.actingUser);
          deleted.push({ id: existingShift.id, date: dateKey });
        }

        cursor = addDays(cursor, 1);
        continue;
      }

      if (exception?.type === 'MODIFIED') {
        if (existingShift && !existingShift.isSeriesException) {
          await tx.shift.update({
            where: { id: existingShift.id },
            data: { isSeriesException: true },
          });
        }

        cursor = addDays(cursor, 1);
        continue;
      }

      try {
        await validatePhysiotherapistAssignment(tx, series.physiotherapistId, series.shiftTeamId, occurrenceDate);
        await validateShiftDuplicate({
          physiotherapistId: series.physiotherapistId,
          date: occurrenceDate,
          period: series.period,
          ignoreShiftId: existingShift?.id,
        });

        const slotId = await resolveSeriesSlotId(tx, {
          shiftTeamId: series.shiftTeamId,
          period: series.period,
          date: occurrenceDate,
          preferredSlot,
          ignoreShiftId: existingShift?.id,
        });

        if (existingShift) {
          const needsUpdate =
            existingShift.physiotherapistId !== series.physiotherapistId ||
            existingShift.period !== series.period ||
            existingShift.shiftTeamId !== series.shiftTeamId ||
            existingShift.shiftTeamSlotId !== slotId ||
            existingShift.isSeriesException;

          if (needsUpdate) {
            await tx.shift.update({
              where: { id: existingShift.id },
              data: {
                physiotherapistId: series.physiotherapistId,
                period: series.period,
                shiftTeamId: series.shiftTeamId,
                shiftTeamSlotId: slotId,
                isSeriesException: false,
              },
            });

            updated.push({ id: existingShift.id, date: dateKey });
          }
        } else {
          const createdShift = await tx.shift.create({
            data: {
              date: occurrenceDate,
              period: series.period,
              physiotherapistId: series.physiotherapistId,
              shiftTeamId: series.shiftTeamId,
              shiftTeamSlotId: slotId,
              shiftSeriesId: series.id,
            },
          });

          created.push({ id: createdShift.id, date: dateKey });
        }
      } catch (error) {
        const reason =
          error instanceof ShiftCreationError
            ? error.message
            : 'Falha inesperada ao sincronizar uma ocorrência da série.';

        if (existingShift && !existingShift.isSeriesException) {
          await upsertSeriesException(tx, {
            shiftSeriesId: series.id,
            occurrenceDate,
            type: ShiftSeriesExceptionType.MODIFIED,
            shiftId: existingShift.id,
          });

          await tx.shift.update({
            where: { id: existingShift.id },
            data: { isSeriesException: true },
          });
        }

        skipped.push({
          date: dateKey,
          reason,
        });
      }
    }

    cursor = addDays(cursor, 1);
  }

  const removableShifts = await tx.shift.findMany({
    where: {
      shiftSeriesId: series.id,
      date: {
        gte: startDate,
        lte: endDate,
      },
      isSeriesException: false,
    },
    include: {
      physiotherapist: { select: { name: true } },
      shiftTeam: { select: { name: true } },
    },
  });

  const shiftsToDelete = removableShifts.filter((shift) => !desiredDates.has(toDateOnlyString(shift.date)));
  await deleteShiftsWithLogs(tx, shiftsToDelete, params.actingUser);
  deleted.push(...shiftsToDelete.map((shift) => ({ id: shift.id, date: toDateOnlyString(shift.date) })));

  return { created, updated, deleted, skipped };
}

export async function createRecurringShiftSeries(params: {
  startDate: Date;
  endDate: Date;
  weekdays: number[];
  physiotherapistId: number;
  period: ShiftPeriod;
  shiftTeamId: number;
  shiftTeamSlotId: number;
  actingUser: ActingUser;
}) {
  const weekdays = normalizeWeekdays(params.weekdays);
  const preferredSlot = await getPreferredSlot(params.shiftTeamSlotId);

  if (preferredSlot.shiftTeamId !== params.shiftTeamId || preferredSlot.period !== params.period) {
    throw new ShiftCreationError('A vaga base da recorrência não pertence à equipe/período selecionados.');
  }

  if (params.endDate < params.startDate) {
    throw new ShiftCreationError('A data final da recorrência deve ser igual ou posterior à data inicial.');
  }

  return prisma.$transaction(async (tx) => {
    const series = await tx.shiftSeries.create({
      data: {
        shiftTeamId: params.shiftTeamId,
        physiotherapistId: params.physiotherapistId,
        shiftTeamSlotId: params.shiftTeamSlotId,
        period: params.period,
        startDate: params.startDate,
        endDate: params.endDate,
        weekdays,
      },
    });

    const summary = await syncSeriesRange(tx, {
      seriesId: series.id,
      actingUser: params.actingUser,
    });

    return {
      seriesId: series.id,
      weekdays,
      ...summary,
    };
  });
}

export async function updateShiftWithScope(params: {
  shiftId: number;
  scope: ShiftSeriesScope;
  physiotherapistId: number;
  period: ShiftPeriod;
  shiftTeamSlotId?: number;
  date?: Date;
  recurrence?: {
    endDate?: Date;
    weekdays?: number[];
  };
  actingUser: ActingUser;
}) {
  return prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({
      where: { id: params.shiftId },
      include: {
        shiftSeries: true,
      },
    });

    if (!shift) {
      throw new ShiftCreationError('Plantão não encontrado', 404);
    }

    const targetDate = params.date ?? shift.date;
    const originalDate = shift.date;

    if (!shift.shiftSeriesId || params.scope === 'THIS') {
      const updatedShift = await applySingleShiftMutation(tx, {
        shift,
        physiotherapistId: params.physiotherapistId,
        period: params.period,
        date: targetDate,
        shiftTeamId: shift.shiftTeamId,
        shiftTeamSlotId: params.shiftTeamSlotId ?? shift.shiftTeamSlotId,
      });

      if (shift.shiftSeriesId) {
        const series = await fetchSeriesOrThrow(tx, shift.shiftSeriesId);
        const movedOccurrence = toDateOnlyString(originalDate) !== toDateOnlyString(targetDate);
        const baseSlotId = await resolveSeriesSlotId(tx, {
          shiftTeamId: series.shiftTeamId,
          period: series.period,
          date: targetDate,
          preferredSlot: series.shiftTeamSlot,
          ignoreShiftId: shift.id,
        });

        const matchesSeries =
          params.physiotherapistId === series.physiotherapistId &&
          params.period === series.period &&
          updatedShift.shiftTeamSlotId === baseSlotId &&
          shift.shiftTeamId === series.shiftTeamId &&
          isDateIncludedBySeries(targetDate, series);

        if (movedOccurrence) {
          if (isDateIncludedBySeries(originalDate, series)) {
            await upsertSeriesException(tx, {
              shiftSeriesId: series.id,
              occurrenceDate: originalDate,
              type: ShiftSeriesExceptionType.SKIP,
              shiftId: null,
            });
          } else {
            await clearSeriesException(tx, series.id, originalDate);
          }
        }

        if (matchesSeries) {
          await clearSeriesException(tx, series.id, targetDate);
          await tx.shift.update({
            where: { id: updatedShift.id },
            data: { isSeriesException: false },
          });
        } else {
          await upsertSeriesException(tx, {
            shiftSeriesId: series.id,
            occurrenceDate: targetDate,
            type: ShiftSeriesExceptionType.MODIFIED,
            shiftId: updatedShift.id,
          });
          await tx.shift.update({
            where: { id: updatedShift.id },
            data: { isSeriesException: true },
          });
        }
      }

      return {
        mode: 'THIS',
        shiftId: updatedShift.id,
      };
    }

    const currentSeries = await fetchSeriesOrThrow(tx, shift.shiftSeriesId);
    const nextWeekdays = params.recurrence?.weekdays
      ? normalizeWeekdays(params.recurrence.weekdays)
      : currentSeries.weekdays;
    const nextEndDate = params.recurrence?.endDate ?? currentSeries.endDate;
    const nextBaseSlotId = params.shiftTeamSlotId ?? currentSeries.shiftTeamSlotId;

    await validateSeriesBaseSlot(currentSeries.shiftTeamId, params.period, nextBaseSlotId);

    if (params.scope === 'ALL' || targetDate <= currentSeries.startDate) {
      if (nextEndDate < currentSeries.startDate) {
        throw new ShiftCreationError('A data final da série não pode ser anterior à data inicial.');
      }

      await tx.shiftSeries.update({
        where: { id: currentSeries.id },
        data: {
          physiotherapistId: params.physiotherapistId,
          period: params.period,
          shiftTeamSlotId: nextBaseSlotId,
          endDate: nextEndDate,
          weekdays: nextWeekdays,
          status: ShiftSeriesStatus.ACTIVE,
        },
      });

      await pruneSeriesAfterEndDate(tx, currentSeries.id, nextEndDate, params.actingUser);

      const summary = await syncSeriesRange(tx, {
        seriesId: currentSeries.id,
        actingUser: params.actingUser,
      });

      return {
        mode: 'ALL',
        seriesId: currentSeries.id,
        ...summary,
      };
    }

    const splitStartDate = targetDate;

    if (nextEndDate < splitStartDate) {
      throw new ShiftCreationError('A data final da nova série deve ser igual ou posterior à data inicial.');
    }

    const newSeries = await tx.shiftSeries.create({
      data: {
        shiftTeamId: currentSeries.shiftTeamId,
        physiotherapistId: params.physiotherapistId,
        period: params.period,
        shiftTeamSlotId: nextBaseSlotId,
        startDate: splitStartDate,
        endDate: nextEndDate,
        weekdays: nextWeekdays,
      },
    });

    const futureShifts = await tx.shift.findMany({
      where: {
        shiftSeriesId: currentSeries.id,
        date: {
          gte: splitStartDate,
        },
      },
      include: {
        physiotherapist: { select: { name: true } },
        shiftTeam: { select: { name: true } },
      },
    });

    const shiftsToMove = futureShifts.filter((item) => item.date <= nextEndDate);
    const shiftsToDelete = futureShifts.filter((item) => item.date > nextEndDate);

    if (shiftsToMove.length > 0) {
      await tx.shift.updateMany({
        where: {
          id: {
            in: shiftsToMove.map((item) => item.id),
          },
        },
        data: {
          shiftSeriesId: newSeries.id,
        },
      });
    }

    await deleteShiftsWithLogs(tx, shiftsToDelete, params.actingUser);

    await tx.shiftSeriesException.updateMany({
      where: {
        shiftSeriesId: currentSeries.id,
        occurrenceDate: {
          gte: splitStartDate,
          lte: nextEndDate,
        },
      },
      data: {
        shiftSeriesId: newSeries.id,
      },
    });

    await tx.shiftSeriesException.deleteMany({
      where: {
        shiftSeriesId: currentSeries.id,
        occurrenceDate: {
          gt: nextEndDate,
        },
      },
    });

    await tx.shiftSeries.update({
      where: { id: currentSeries.id },
      data: {
        endDate: subtractDays(splitStartDate, 1),
        status: ShiftSeriesStatus.ACTIVE,
      },
    });

    const summary = await syncSeriesRange(tx, {
      seriesId: newSeries.id,
      actingUser: params.actingUser,
    });

    return {
      mode: 'THIS_AND_FUTURE',
      previousSeriesId: currentSeries.id,
      seriesId: newSeries.id,
      ...summary,
    };
  });
}

export async function deleteShiftWithScope(params: {
  shiftId: number;
  scope: ShiftSeriesScope;
  actingUser: ActingUser;
}) {
  return prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({
      where: { id: params.shiftId },
      include: {
        shiftSeries: true,
        physiotherapist: { select: { name: true } },
        shiftTeam: { select: { name: true } },
      },
    });

    if (!shift) {
      throw new ShiftCreationError('Plantão não encontrado', 404);
    }

    if (!shift.shiftSeriesId || params.scope === 'THIS') {
      if (shift.shiftSeriesId) {
        const series = await fetchSeriesOrThrow(tx, shift.shiftSeriesId);

        if (isDateIncludedBySeries(shift.date, series)) {
          await upsertSeriesException(tx, {
            shiftSeriesId: shift.shiftSeriesId,
            occurrenceDate: shift.date,
            type: ShiftSeriesExceptionType.SKIP,
            shiftId: null,
          });
        } else {
          await clearSeriesException(tx, shift.shiftSeriesId, shift.date);
        }
      }

      await deleteShiftsWithLogs(tx, [shift], params.actingUser);

      return {
        mode: 'THIS',
        deleted: [{ id: shift.id, date: toDateOnlyString(shift.date) }],
      };
    }

    const series = await fetchSeriesOrThrow(tx, shift.shiftSeriesId);

    if (params.scope === 'ALL' || shift.date <= series.startDate) {
      const seriesShifts = await tx.shift.findMany({
        where: {
          shiftSeriesId: series.id,
        },
        include: {
          physiotherapist: { select: { name: true } },
          shiftTeam: { select: { name: true } },
        },
      });

      await deleteShiftsWithLogs(tx, seriesShifts, params.actingUser);
      await tx.shiftSeriesException.deleteMany({
        where: { shiftSeriesId: series.id },
      });
      await tx.shiftSeries.update({
        where: { id: series.id },
        data: {
          status: ShiftSeriesStatus.CANCELLED,
          endDate: shift.date,
        },
      });

      return {
        mode: 'ALL',
        deleted: seriesShifts.map((item) => ({ id: item.id, date: toDateOnlyString(item.date) })),
      };
    }

    const cutoffDate = shift.date;
    const futureShifts = await tx.shift.findMany({
      where: {
        shiftSeriesId: series.id,
        date: {
          gte: cutoffDate,
        },
      },
      include: {
        physiotherapist: { select: { name: true } },
        shiftTeam: { select: { name: true } },
      },
    });

    await deleteShiftsWithLogs(tx, futureShifts, params.actingUser);
    await tx.shiftSeriesException.deleteMany({
      where: {
        shiftSeriesId: series.id,
        occurrenceDate: {
          gte: cutoffDate,
        },
      },
    });
    await tx.shiftSeries.update({
      where: { id: series.id },
      data: {
        endDate: subtractDays(cutoffDate, 1),
      },
    });

    return {
      mode: 'THIS_AND_FUTURE',
      deleted: futureShifts.map((item) => ({ id: item.id, date: toDateOnlyString(item.date) })),
    };
  });
}
