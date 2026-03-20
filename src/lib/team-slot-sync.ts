import { Prisma, ShiftPeriod, ShiftSlotDayType } from '@prisma/client';

import {
  SHIFT_PERIODS,
  SHIFT_SLOT_DAY_TYPES,
  type TeamSlotPayload,
  countSlotsByPeriod,
} from '@/lib/shift-team-slots';

export function buildTeamSlotCounts(payload: TeamSlotPayload) {
  return {
    morningSlots: countSlotsByPeriod(payload, 'WEEKDAY', 'MORNING'),
    intermediateSlots: countSlotsByPeriod(payload, 'WEEKDAY', 'INTERMEDIATE'),
    afternoonSlots: countSlotsByPeriod(payload, 'WEEKDAY', 'AFTERNOON'),
    nightSlots: countSlotsByPeriod(payload, 'WEEKDAY', 'NIGHT'),
    weekdayMorningSlots: countSlotsByPeriod(payload, 'WEEKDAY', 'MORNING'),
    weekdayIntermediateSlots: countSlotsByPeriod(payload, 'WEEKDAY', 'INTERMEDIATE'),
    weekdayAfternoonSlots: countSlotsByPeriod(payload, 'WEEKDAY', 'AFTERNOON'),
    weekdayNightSlots: countSlotsByPeriod(payload, 'WEEKDAY', 'NIGHT'),
    weekendMorningSlots: countSlotsByPeriod(payload, 'WEEKEND', 'MORNING'),
    weekendIntermediateSlots: countSlotsByPeriod(payload, 'WEEKEND', 'INTERMEDIATE'),
    weekendAfternoonSlots: countSlotsByPeriod(payload, 'WEEKEND', 'AFTERNOON'),
    weekendNightSlots: countSlotsByPeriod(payload, 'WEEKEND', 'NIGHT'),
  };
}

export async function createTeamSlots(
  tx: Prisma.TransactionClient,
  shiftTeamId: number,
  payload: TeamSlotPayload
) {
  const data: Prisma.ShiftTeamSlotCreateManyInput[] = [];

  for (const dayType of SHIFT_SLOT_DAY_TYPES) {
    for (const period of SHIFT_PERIODS) {
      payload[dayType][period].forEach((description, index) => {
        data.push({
          shiftTeamId,
          dayType,
          period,
          description,
          sortOrder: index + 1,
          isActive: true,
        });
      });
    }
  }

  if (data.length > 0) {
    await tx.shiftTeamSlot.createMany({ data });
  }
}

export async function syncTeamSlots(
  tx: Prisma.TransactionClient,
  shiftTeamId: number,
  payload: TeamSlotPayload
) {
  const existingSlots = await tx.shiftTeamSlot.findMany({
    where: { shiftTeamId },
    orderBy: [{ dayType: 'asc' }, { period: 'asc' }, { sortOrder: 'asc' }],
  });

  for (const dayType of SHIFT_SLOT_DAY_TYPES) {
    for (const period of SHIFT_PERIODS) {
      const matchingSlots = existingSlots
        .filter((slot) => slot.dayType === dayType && slot.period === period)
        .sort((left, right) => left.sortOrder - right.sortOrder);
      const desiredDescriptions = payload[dayType][period];
      const desiredSlotIds: number[] = [];

      for (let index = 0; index < desiredDescriptions.length; index += 1) {
        const slot = matchingSlots[index];
        const description = desiredDescriptions[index];

        if (slot) {
          const updatedSlot = await tx.shiftTeamSlot.update({
            where: { id: slot.id },
            data: {
              description,
              sortOrder: index + 1,
              isActive: true,
            },
          });
          desiredSlotIds.push(updatedSlot.id);
          continue;
        }

        const createdSlot = await tx.shiftTeamSlot.create({
          data: {
            shiftTeamId,
            dayType,
            period,
            description,
            sortOrder: index + 1,
            isActive: true,
          },
        });
        desiredSlotIds.push(createdSlot.id);
      }

      const extraSlots = matchingSlots.slice(desiredDescriptions.length);

      if (extraSlots.length > 0) {
        await reassignFutureShiftsFromExtraSlots(tx, shiftTeamId, period, extraSlots.map((slot) => slot.id), desiredSlotIds);

        for (const slot of extraSlots) {
          if (!slot.isActive) continue;

          await tx.shiftTeamSlot.update({
            where: { id: slot.id },
            data: {
              isActive: false,
            },
          });
        }
      }
    }
  }
}

async function reassignFutureShiftsFromExtraSlots(
  tx: Prisma.TransactionClient,
  shiftTeamId: number,
  period: ShiftPeriod,
  fromSlotIds: number[],
  toSlotIds: number[]
) {
  if (fromSlotIds.length === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureShifts = await tx.shift.findMany({
    where: {
      shiftTeamId,
      period,
      shiftTeamSlotId: { in: fromSlotIds },
      date: { gte: today },
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      date: true,
      shiftTeamSlotId: true,
    },
  });

  if (futureShifts.length === 0) return;
  if (toSlotIds.length === 0) {
    throw new Error('Não é possível remover todas as vagas enquanto existem plantões futuros vinculados a elas.');
  }

  const occupiedShifts = await tx.shift.findMany({
    where: {
      shiftTeamId,
      period,
      shiftTeamSlotId: { in: toSlotIds },
      date: { gte: today },
    },
    select: {
      id: true,
      date: true,
      shiftTeamSlotId: true,
    },
  });

  const occupiedByDate = new Map<string, Set<number>>();

  for (const shift of occupiedShifts) {
    const key = shift.date.toISOString();
    const current = occupiedByDate.get(key) ?? new Set<number>();
    current.add(shift.shiftTeamSlotId);
    occupiedByDate.set(key, current);
  }

  for (const shift of futureShifts) {
    const key = shift.date.toISOString();
    const occupied = occupiedByDate.get(key) ?? new Set<number>();
    const availableSlotId = toSlotIds.find((slotId) => !occupied.has(slotId));

    if (!availableSlotId) {
      throw new Error('Não foi possível reorganizar as vagas da equipe sem conflitar com plantões futuros.');
    }

    await tx.shift.update({
      where: { id: shift.id },
      data: {
        shiftTeamSlotId: availableSlotId,
      },
    });

    occupied.add(availableSlotId);
    occupiedByDate.set(key, occupied);
  }
}
