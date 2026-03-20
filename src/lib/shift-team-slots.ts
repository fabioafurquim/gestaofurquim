import { ShiftPeriod, ShiftSlotDayType, type ShiftTeamSlot } from '@prisma/client';

export const SHIFT_PERIODS: ShiftPeriod[] = ['MORNING', 'INTERMEDIATE', 'AFTERNOON', 'NIGHT'];
export const SHIFT_SLOT_DAY_TYPES: ShiftSlotDayType[] = ['WEEKDAY', 'WEEKEND'];

export const SHIFT_PERIOD_LABELS: Record<ShiftPeriod, string> = {
  MORNING: 'Manhã',
  INTERMEDIATE: 'Intermediário',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noite',
};

export const SHIFT_SLOT_DAY_TYPE_LABELS: Record<ShiftSlotDayType, string> = {
  WEEKDAY: 'Dias úteis',
  WEEKEND: 'Fins de semana e feriados',
};

export type TeamSlotPayload = Record<ShiftSlotDayType, Record<ShiftPeriod, string[]>>;

export type ActiveShiftTeamSlot = Pick<
  ShiftTeamSlot,
  'id' | 'period' | 'dayType' | 'description' | 'sortOrder' | 'isActive'
>;

export function createEmptyTeamSlotPayload(): TeamSlotPayload {
  return {
    WEEKDAY: {
      MORNING: [],
      INTERMEDIATE: [],
      AFTERNOON: [],
      NIGHT: [],
    },
    WEEKEND: {
      MORNING: [],
      INTERMEDIATE: [],
      AFTERNOON: [],
      NIGHT: [],
    },
  };
}

export function buildDefaultSlotDescription(period: ShiftPeriod, sortOrder: number) {
  return `${SHIFT_PERIOD_LABELS[period]} ${sortOrder}`;
}

export function normalizeTeamSlotPayload(input: unknown): TeamSlotPayload {
  const normalized = createEmptyTeamSlotPayload();
  const source = isRecord(input) ? input : {};

  for (const dayType of SHIFT_SLOT_DAY_TYPES) {
    const daySlots = isRecord(source[dayType]) ? source[dayType] : {};

    for (const period of SHIFT_PERIODS) {
      const rawEntries = Array.isArray(daySlots[period]) ? daySlots[period] : [];
      normalized[dayType][period] = rawEntries.map((entry, index) => {
        const value = typeof entry === 'string' ? entry.trim() : '';
        return value || buildDefaultSlotDescription(period, index + 1);
      });
    }
  }

  return normalized;
}

export function buildTeamSlotPayloadFromLegacyCounts(input: Record<string, unknown>): TeamSlotPayload {
  const payload = createEmptyTeamSlotPayload();

  for (const period of SHIFT_PERIODS) {
    const weekdayCount = Number(input[getLegacyCountField(period, 'WEEKDAY')] ?? 0);
    const weekendCount = Number(input[getLegacyCountField(period, 'WEEKEND')] ?? 0);

    payload.WEEKDAY[period] = buildLegacyDescriptionList(period, weekdayCount);
    payload.WEEKEND[period] = buildLegacyDescriptionList(period, weekendCount);
  }

  return payload;
}

export function buildTeamSlotPayloadFromSlots(slots: ActiveShiftTeamSlot[]): TeamSlotPayload {
  const payload = createEmptyTeamSlotPayload();

  for (const dayType of SHIFT_SLOT_DAY_TYPES) {
    for (const period of SHIFT_PERIODS) {
      payload[dayType][period] = slots
        .filter((slot) => slot.dayType === dayType && slot.period === period && slot.isActive)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((slot, index) => slot.description?.trim() || buildDefaultSlotDescription(period, index + 1));
    }
  }

  return payload;
}

export function countSlotsByPeriod(payload: TeamSlotPayload, dayType: ShiftSlotDayType, period: ShiftPeriod) {
  return payload[dayType][period].length;
}

export function getSlotDayTypeForDate(date: Date, isWeekendOrHoliday: boolean): ShiftSlotDayType {
  return isWeekendOrHoliday ? 'WEEKEND' : 'WEEKDAY';
}

function buildLegacyDescriptionList(period: ShiftPeriod, count: number) {
  return Array.from({ length: Math.max(0, count) }, (_, index) => buildDefaultSlotDescription(period, index + 1));
}

function getLegacyCountField(period: ShiftPeriod, dayType: ShiftSlotDayType) {
  if (dayType === 'WEEKDAY') {
    switch (period) {
      case 'MORNING':
        return 'weekdayMorningSlots';
      case 'INTERMEDIATE':
        return 'weekdayIntermediateSlots';
      case 'AFTERNOON':
        return 'weekdayAfternoonSlots';
      case 'NIGHT':
        return 'weekdayNightSlots';
    }
  }

  switch (period) {
    case 'MORNING':
      return 'weekendMorningSlots';
    case 'INTERMEDIATE':
      return 'weekendIntermediateSlots';
    case 'AFTERNOON':
      return 'weekendAfternoonSlots';
    case 'NIGHT':
      return 'weekendNightSlots';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
