import { ContractType, ShiftPeriod } from '@prisma/client';

import { prisma } from './prisma';
import { getCustomShiftValueForDate } from './validations';

type HistoricalValueRecord = {
  effectiveFrom: Date;
  value: number | null;
};

export interface MonthlyShiftPaymentEntry {
  shiftId: number;
  date: Date;
  period: ShiftPeriod;
  physiotherapistId: number;
  physiotherapistName: string;
  physiotherapistEmail: string;
  contractType: ContractType;
  teamId: number;
  teamName: string;
  shiftValue: number;
  additionalValue: number;
}

export interface MonthlyTeamPaymentSummary {
  teamId: number;
  teamName: string;
  periods: Record<ShiftPeriod, number>;
  totalShifts: number;
  totalValue: number;
  shiftValues: number[];
}

export interface MonthlyPhysiotherapistPaymentSummary {
  physiotherapistId: number;
  physiotherapistName: string;
  email: string;
  contractType: ContractType;
  teamBreakdown: Map<number, MonthlyTeamPaymentSummary>;
  totalShifts: number;
  totalShiftValue: number;
  additionalValue: number;
  grossValue: number;
  shiftDetails: MonthlyShiftPaymentEntry[];
}

export interface MonthlyPaymentFilters {
  teamId?: number;
  physioId?: number;
}

function getMonthBounds(referenceMonth: string) {
  if (!/^\d{4}-\d{2}$/.test(referenceMonth)) {
    throw new Error('Formato de mês inválido. Use YYYY-MM');
  }

  const [year, month] = referenceMonth.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  return { startDate, endDate };
}

function resolveHistoricalValue(
  records: HistoricalValueRecord[],
  targetDate: Date,
  fallback: number | null
): number | null {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index]!.effectiveFrom <= targetDate) {
      return records[index]!.value;
    }
  }

  return fallback;
}

/**
 * Calcula o valor de um plantão considerando histórico de preços
 * Prioriza valor customizado do fisioterapeuta na equipe, depois valor da equipe
 */
export async function calculateShiftValue(
  shiftTeamId: number,
  physiotherapistId: number,
  shiftDate: Date
): Promise<number> {
  const physioTeam = await prisma.physiotherapistTeam.findFirst({
    where: {
      physiotherapistId,
      shiftTeamId,
    },
    select: {
      id: true,
      customShiftValue: true,
    },
  });

  if (physioTeam) {
    const customValue = await getCustomShiftValueForDate(physioTeam.id, shiftDate);

    if (customValue !== null) {
      return customValue;
    }
  }

  const teamHistory = await prisma.shiftTeamPriceHistory.findFirst({
    where: {
      shiftTeamId,
      effectiveFrom: {
        lte: shiftDate,
      },
    },
    orderBy: {
      effectiveFrom: 'desc',
    },
    select: {
      shiftValue: true,
    },
  });

  if (teamHistory) {
    return Number(teamHistory.shiftValue);
  }

  const team = await prisma.shiftTeam.findUnique({
    where: { id: shiftTeamId },
    select: { shiftValue: true },
  });

  return team ? Number(team.shiftValue) : 0;
}

/**
 * Monta a base mensal com o valor real de cada plantão
 * Essa função é a fonte única de verdade para os cálculos financeiros do mês.
 */
export async function buildMonthlyShiftPaymentEntries(
  referenceMonth: string,
  filters: MonthlyPaymentFilters = {}
): Promise<MonthlyShiftPaymentEntry[]> {
  const { startDate, endDate } = getMonthBounds(referenceMonth);

  const shifts = await prisma.shift.findMany({
    where: {
      date: {
        gte: startDate,
        lt: endDate,
      },
      ...(filters.teamId ? { shiftTeamId: filters.teamId } : {}),
      ...(filters.physioId ? { physiotherapistId: filters.physioId } : {}),
    },
    include: {
      physiotherapist: {
        select: {
          id: true,
          name: true,
          email: true,
          contractType: true,
          additionalValue: true,
        },
      },
      shiftTeam: {
        select: {
          id: true,
          name: true,
          shiftValue: true,
        },
      },
    },
    orderBy: [{ date: 'asc' }, { period: 'asc' }],
  });

  if (shifts.length === 0) {
    return [];
  }

  const teamIds = [...new Set(shifts.map((shift) => shift.shiftTeamId))];
  const physiotherapistIds = [...new Set(shifts.map((shift) => shift.physiotherapistId))];

  const physiotherapistTeams = await prisma.physiotherapistTeam.findMany({
    where: {
      physiotherapistId: { in: physiotherapistIds },
      shiftTeamId: { in: teamIds },
    },
    select: {
      id: true,
      physiotherapistId: true,
      shiftTeamId: true,
      customShiftValue: true,
    },
  });

  const teamHistories = await prisma.shiftTeamPriceHistory.findMany({
    where: {
      shiftTeamId: { in: teamIds },
      effectiveFrom: {
        lte: endDate,
      },
    },
    select: {
      shiftTeamId: true,
      shiftValue: true,
      effectiveFrom: true,
    },
    orderBy: {
      effectiveFrom: 'asc',
    },
  });

  const customHistories = await prisma.physiotherapistTeamPriceHistory.findMany({
    where: {
      physiotherapistTeamId: {
        in: physiotherapistTeams.map((item) => item.id),
      },
      effectiveFrom: {
        lte: endDate,
      },
    },
    select: {
      physiotherapistTeamId: true,
      customShiftValue: true,
      effectiveFrom: true,
    },
    orderBy: {
      effectiveFrom: 'asc',
    },
  });

  const teamById = new Map<number, { id: number; name: string; shiftValue: unknown }>();
  for (const shift of shifts) {
    teamById.set(shift.shiftTeamId, shift.shiftTeam);
  }

  const physioTeamByKey = new Map<string, (typeof physiotherapistTeams)[number]>();
  for (const physioTeam of physiotherapistTeams) {
    physioTeamByKey.set(`${physioTeam.physiotherapistId}-${physioTeam.shiftTeamId}`, physioTeam);
  }

  const teamHistoryMap = new Map<number, HistoricalValueRecord[]>();
  for (const history of teamHistories) {
    const current = teamHistoryMap.get(history.shiftTeamId) ?? [];
    current.push({
      effectiveFrom: history.effectiveFrom,
      value: Number(history.shiftValue),
    });
    teamHistoryMap.set(history.shiftTeamId, current);
  }

  const customHistoryMap = new Map<number, HistoricalValueRecord[]>();
  for (const history of customHistories) {
    const current = customHistoryMap.get(history.physiotherapistTeamId) ?? [];
    current.push({
      effectiveFrom: history.effectiveFrom,
      value: history.customShiftValue !== null ? Number(history.customShiftValue) : null,
    });
    customHistoryMap.set(history.physiotherapistTeamId, current);
  }

  return shifts.map((shift) => {
    const team = teamById.get(shift.shiftTeamId)!;
    const physioTeam = physioTeamByKey.get(`${shift.physiotherapistId}-${shift.shiftTeamId}`);
    const currentTeamValue = Number(team.shiftValue) || 0;
    const teamValue = resolveHistoricalValue(teamHistoryMap.get(shift.shiftTeamId) ?? [], shift.date, currentTeamValue) ?? 0;

    let customValue: number | null = null;

    if (physioTeam) {
      const currentCustomValue =
        physioTeam.customShiftValue !== null && physioTeam.customShiftValue !== undefined
          ? Number(physioTeam.customShiftValue)
          : null;

      customValue =
        resolveHistoricalValue(
          customHistoryMap.get(physioTeam.id) ?? [],
          shift.date,
          currentCustomValue
        );
    }

    return {
      shiftId: shift.id,
      date: shift.date,
      period: shift.period,
      physiotherapistId: shift.physiotherapistId,
      physiotherapistName: shift.physiotherapist.name,
      physiotherapistEmail: shift.physiotherapist.email || '',
      contractType: shift.physiotherapist.contractType,
      teamId: shift.shiftTeamId,
      teamName: team.name,
      shiftValue: customValue !== null ? customValue : teamValue,
      additionalValue: Number(shift.physiotherapist.additionalValue) || 0,
    };
  });
}

export function groupMonthlyShiftPaymentEntries(
  entries: MonthlyShiftPaymentEntry[]
): MonthlyPhysiotherapistPaymentSummary[] {
  const summaries = new Map<number, MonthlyPhysiotherapistPaymentSummary>();

  for (const entry of entries) {
    const existing = summaries.get(entry.physiotherapistId);

    if (!existing) {
      summaries.set(entry.physiotherapistId, {
        physiotherapistId: entry.physiotherapistId,
        physiotherapistName: entry.physiotherapistName,
        email: entry.physiotherapistEmail,
        contractType: entry.contractType,
        teamBreakdown: new Map(),
        totalShifts: 0,
        totalShiftValue: 0,
        additionalValue: entry.additionalValue,
        grossValue: 0,
        shiftDetails: [],
      });
    }

    const summary = summaries.get(entry.physiotherapistId)!;
    const teamSummary = summary.teamBreakdown.get(entry.teamId) ?? {
      teamId: entry.teamId,
      teamName: entry.teamName,
      periods: {
        MORNING: 0,
        INTERMEDIATE: 0,
        AFTERNOON: 0,
        NIGHT: 0,
      },
      totalShifts: 0,
      totalValue: 0,
      shiftValues: [],
    };

    teamSummary.periods[entry.period] += 1;
    teamSummary.totalShifts += 1;
    teamSummary.totalValue += entry.shiftValue;
    teamSummary.shiftValues.push(entry.shiftValue);

    summary.teamBreakdown.set(entry.teamId, teamSummary);
    summary.totalShifts += 1;
    summary.totalShiftValue += entry.shiftValue;
    summary.additionalValue = entry.additionalValue;
    summary.grossValue = summary.totalShiftValue + summary.additionalValue;
    summary.shiftDetails.push(entry);
  }

  return [...summaries.values()].sort((a, b) => a.physiotherapistName.localeCompare(b.physiotherapistName));
}

/**
 * Calcula pagamento de um fisioterapeuta para um mês específico
 * Usa histórico de valores para cada plantão
 */
export async function calculateMonthlyPayment(
  physiotherapistId: number,
  referenceMonth: string
): Promise<{
  totalShifts: number;
  totalValue: number;
  shiftDetails: Array<{
    date: string;
    period: string;
    teamName: string;
    value: number;
  }>;
}> {
  const entries = await buildMonthlyShiftPaymentEntries(referenceMonth, { physioId: physiotherapistId });
  const totalValue = entries.reduce((sum, entry) => sum + entry.shiftValue, 0);

  return {
    totalShifts: entries.length,
    totalValue,
    shiftDetails: entries.map((entry) => ({
      date: new Date(entry.date).toLocaleDateString('pt-BR'),
      period: entry.period,
      teamName: entry.teamName,
      value: entry.shiftValue,
    })),
  };
}

/**
 * Calcula pagamentos de todos os fisioterapeutas para um mês
 * Retorna lista com valores calculados usando histórico
 */
export async function calculateAllMonthlyPayments(
  referenceMonth: string
): Promise<
  Array<{
    physiotherapistId: number;
    physiotherapistName: string;
    email: string;
    contractType: string;
    totalShifts: number;
    totalShiftValue: number;
    additionalValue: number;
    grossValue: number;
  }>
> {
  const entries = await buildMonthlyShiftPaymentEntries(referenceMonth);
  const summaries = groupMonthlyShiftPaymentEntries(entries);

  return summaries.map((summary) => ({
    physiotherapistId: summary.physiotherapistId,
    physiotherapistName: summary.physiotherapistName,
    email: summary.email,
    contractType: summary.contractType || 'NO_CONTRACT',
    totalShifts: summary.totalShifts,
    totalShiftValue: summary.totalShiftValue,
    additionalValue: summary.additionalValue,
    grossValue: summary.grossValue,
  }));
}
