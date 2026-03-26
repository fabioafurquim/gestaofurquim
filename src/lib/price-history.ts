import { Prisma, PrismaClient, UserRole } from '@prisma/client';

import { prisma } from './prisma';

type DbClient = PrismaClient | Prisma.TransactionClient;

type HistoryMonthStatus = {
  month: string;
  controlStatus: string | null;
  hasPaidRecords: boolean;
};

export type PriceHistoryImpactPreview = {
  startDate: Date;
  endDate: Date | null;
  affectedShiftCount: number;
  affectedPhysiotherapistCount: number;
  affectedMonths: string[];
  lockedMonths: HistoryMonthStatus[];
};

export class PriceHistoryError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'PriceHistoryError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

export function parseEffectiveFrom(value: string | Date) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new PriceHistoryError('Data de vigência inválida.');
  }

  return parsed;
}

export function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function compareHistoryDates(a: Date, b: Date) {
  return a.getTime() - b.getTime();
}

async function loadMonthStatuses(months: string[]): Promise<HistoryMonthStatus[]> {
  if (months.length === 0) {
    return [];
  }

  const controls = await prisma.monthlyPaymentControl.findMany({
    where: {
      referenceMonth: { in: months },
    },
    select: {
      referenceMonth: true,
      status: true,
      payments: {
        where: { status: 'PAID' },
        select: { id: true },
        take: 1,
      },
    },
  });

  const map = new Map(
    controls.map((control) => [
      control.referenceMonth,
      {
        controlStatus: control.status,
        hasPaidRecords: control.payments.length > 0,
      },
    ])
  );

  return months
    .map((month) => ({
      month,
      controlStatus: map.get(month)?.controlStatus ?? null,
      hasPaidRecords: map.get(month)?.hasPaidRecords ?? false,
    }))
    .filter((item) => item.controlStatus !== null || item.hasPaidRecords);
}

function resolveHistoryWindow<T extends { effectiveFrom: Date; id: number }>(
  entries: T[],
  candidateId: number
) {
  const ordered = [...entries].sort((left, right) => {
    const dateDiff = compareHistoryDates(left.effectiveFrom, right.effectiveFrom);
    return dateDiff !== 0 ? dateDiff : left.id - right.id;
  });

  const index = ordered.findIndex((entry) => entry.id === candidateId);

  if (index === -1) {
    throw new PriceHistoryError('Registro de histórico não encontrado.', 404);
  }

  return {
    startDate: ordered[index]!.effectiveFrom,
    endDate: ordered[index + 1]?.effectiveFrom ?? null,
  };
}

function resolveHistoryWindowForCandidate<T extends { effectiveFrom: Date; id: number }>(
  entries: T[],
  effectiveFrom: Date,
  excludedId?: number
) {
  const ordered = entries
    .filter((entry) => entry.id !== excludedId)
    .sort((left, right) => {
      const dateDiff = compareHistoryDates(left.effectiveFrom, right.effectiveFrom);
      return dateDiff !== 0 ? dateDiff : left.id - right.id;
    });

  const nextEntry = ordered.find((entry) => entry.effectiveFrom > effectiveFrom);

  return {
    startDate: effectiveFrom,
    endDate: nextEntry?.effectiveFrom ?? null,
  };
}

export function canManageHistoricalCorrection(role: UserRole, effectiveFrom: Date) {
  return role === 'ADMIN' || effectiveFrom >= getTodayStart();
}

export async function syncCurrentTeamShiftValue(db: DbClient, shiftTeamId: number) {
  const currentEntry = await db.shiftTeamPriceHistory.findFirst({
    where: {
      shiftTeamId,
      effectiveFrom: {
        lte: new Date(),
      },
    },
    orderBy: [
      { effectiveFrom: 'desc' },
      { id: 'desc' },
    ],
  });

  if (currentEntry) {
    await db.shiftTeam.update({
      where: { id: shiftTeamId },
      data: {
        shiftValue: currentEntry.shiftValue,
      },
    });
  }
}

export async function syncCurrentCustomShiftValue(db: DbClient, physiotherapistTeamId: number) {
  const currentEntry = await db.physiotherapistTeamPriceHistory.findFirst({
    where: {
      physiotherapistTeamId,
      effectiveFrom: {
        lte: new Date(),
      },
    },
    orderBy: [
      { effectiveFrom: 'desc' },
      { id: 'desc' },
    ],
  });

  if (currentEntry) {
    await db.physiotherapistTeam.update({
      where: { id: physiotherapistTeamId },
      data: {
        customShiftValue: currentEntry.customShiftValue,
      },
    });
  }
}

export async function previewTeamPriceHistoryImpact(
  shiftTeamId: number,
  historyId?: number
): Promise<PriceHistoryImpactPreview> {
  const entries = await prisma.shiftTeamPriceHistory.findMany({
    where: { shiftTeamId },
    select: {
      id: true,
      effectiveFrom: true,
    },
    orderBy: [
      { effectiveFrom: 'asc' },
      { id: 'asc' },
    ],
  });

  if (entries.length === 0) {
    throw new PriceHistoryError('Ainda não há histórico registrado para esta equipe.');
  }

  const targetId = historyId ?? entries[entries.length - 1]!.id;
  const window = resolveHistoryWindow(entries, targetId);

  const shifts = await prisma.shift.findMany({
    where: {
      shiftTeamId,
      date: {
        gte: window.startDate,
        ...(window.endDate ? { lt: window.endDate } : {}),
      },
    },
    select: {
      date: true,
      physiotherapistId: true,
    },
  });

  const affectedMonths = [...new Set(shifts.map((shift) => getMonthKey(shift.date)))].sort();
  const affectedPhysiotherapistCount = new Set(
    shifts.map((shift) => shift.physiotherapistId)
  ).size;

  return {
    startDate: window.startDate,
    endDate: window.endDate,
    affectedShiftCount: shifts.length,
    affectedPhysiotherapistCount,
    affectedMonths,
    lockedMonths: await loadMonthStatuses(affectedMonths),
  };
}

export async function previewTeamPriceHistoryImpactForCandidate(
  shiftTeamId: number,
  effectiveFrom: Date,
  excludedHistoryId?: number
): Promise<PriceHistoryImpactPreview> {
  const entries = await prisma.shiftTeamPriceHistory.findMany({
    where: { shiftTeamId },
    select: {
      id: true,
      effectiveFrom: true,
    },
    orderBy: [
      { effectiveFrom: 'asc' },
      { id: 'asc' },
    ],
  });

  const window = resolveHistoryWindowForCandidate(entries, effectiveFrom, excludedHistoryId);

  const shifts = await prisma.shift.findMany({
    where: {
      shiftTeamId,
      date: {
        gte: window.startDate,
        ...(window.endDate ? { lt: window.endDate } : {}),
      },
    },
    select: {
      date: true,
      physiotherapistId: true,
    },
  });

  const affectedMonths = [...new Set(shifts.map((shift) => getMonthKey(shift.date)))].sort();
  const affectedPhysiotherapistCount = new Set(
    shifts.map((shift) => shift.physiotherapistId)
  ).size;

  return {
    startDate: window.startDate,
    endDate: window.endDate,
    affectedShiftCount: shifts.length,
    affectedPhysiotherapistCount,
    affectedMonths,
    lockedMonths: await loadMonthStatuses(affectedMonths),
  };
}

export async function previewCustomPriceHistoryImpact(
  physiotherapistTeamId: number,
  historyId?: number
): Promise<PriceHistoryImpactPreview> {
  const assignment = await prisma.physiotherapistTeam.findUnique({
    where: { id: physiotherapistTeamId },
    select: {
      id: true,
      physiotherapistId: true,
      shiftTeamId: true,
    },
  });

  if (!assignment) {
    throw new PriceHistoryError('Vínculo entre fisioterapeuta e equipe não encontrado.', 404);
  }

  const entries = await prisma.physiotherapistTeamPriceHistory.findMany({
    where: { physiotherapistTeamId },
    select: {
      id: true,
      effectiveFrom: true,
    },
    orderBy: [
      { effectiveFrom: 'asc' },
      { id: 'asc' },
    ],
  });

  if (entries.length === 0) {
    throw new PriceHistoryError('Ainda não há histórico registrado para este vínculo.');
  }

  const targetId = historyId ?? entries[entries.length - 1]!.id;
  const window = resolveHistoryWindow(entries, targetId);

  const shifts = await prisma.shift.findMany({
    where: {
      shiftTeamId: assignment.shiftTeamId,
      physiotherapistId: assignment.physiotherapistId,
      date: {
        gte: window.startDate,
        ...(window.endDate ? { lt: window.endDate } : {}),
      },
    },
    select: {
      date: true,
      physiotherapistId: true,
    },
  });

  const affectedMonths = [...new Set(shifts.map((shift) => getMonthKey(shift.date)))].sort();

  return {
    startDate: window.startDate,
    endDate: window.endDate,
    affectedShiftCount: shifts.length,
    affectedPhysiotherapistCount: shifts.length > 0 ? 1 : 0,
    affectedMonths,
    lockedMonths: await loadMonthStatuses(affectedMonths),
  };
}

export async function previewCustomPriceHistoryImpactForCandidate(
  physiotherapistTeamId: number,
  effectiveFrom: Date,
  excludedHistoryId?: number
): Promise<PriceHistoryImpactPreview> {
  const assignment = await prisma.physiotherapistTeam.findUnique({
    where: { id: physiotherapistTeamId },
    select: {
      id: true,
      physiotherapistId: true,
      shiftTeamId: true,
    },
  });

  if (!assignment) {
    throw new PriceHistoryError('Vínculo entre fisioterapeuta e equipe não encontrado.', 404);
  }

  const entries = await prisma.physiotherapistTeamPriceHistory.findMany({
    where: { physiotherapistTeamId },
    select: {
      id: true,
      effectiveFrom: true,
    },
    orderBy: [
      { effectiveFrom: 'asc' },
      { id: 'asc' },
    ],
  });

  const window = resolveHistoryWindowForCandidate(entries, effectiveFrom, excludedHistoryId);

  const shifts = await prisma.shift.findMany({
    where: {
      shiftTeamId: assignment.shiftTeamId,
      physiotherapistId: assignment.physiotherapistId,
      date: {
        gte: window.startDate,
        ...(window.endDate ? { lt: window.endDate } : {}),
      },
    },
    select: {
      date: true,
    },
  });

  const affectedMonths = [...new Set(shifts.map((shift) => getMonthKey(shift.date)))].sort();

  return {
    startDate: window.startDate,
    endDate: window.endDate,
    affectedShiftCount: shifts.length,
    affectedPhysiotherapistCount: shifts.length > 0 ? 1 : 0,
    affectedMonths,
    lockedMonths: await loadMonthStatuses(affectedMonths),
  };
}

export async function createTeamPriceHistoryEntry(
  db: DbClient,
  params: {
    shiftTeamId: number;
    shiftValue: number;
    effectiveFrom: Date;
    createdBy?: number | null;
    changeReason?: string | null;
  }
) {
  const duplicate = await db.shiftTeamPriceHistory.findFirst({
    where: {
      shiftTeamId: params.shiftTeamId,
      effectiveFrom: params.effectiveFrom,
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new PriceHistoryError('Já existe um valor cadastrado para esta vigência.');
  }

  const created = await db.shiftTeamPriceHistory.create({
    data: {
      shiftTeamId: params.shiftTeamId,
      shiftValue: params.shiftValue,
      effectiveFrom: params.effectiveFrom,
      createdBy: params.createdBy ?? null,
      updatedBy: params.createdBy ?? null,
      changeReason: params.changeReason?.trim() || null,
    },
  });

  await syncCurrentTeamShiftValue(db, params.shiftTeamId);

  return created;
}

export async function updateTeamPriceHistoryEntry(
  db: DbClient,
  params: {
    historyId: number;
    shiftValue: number;
    effectiveFrom: Date;
    updatedBy?: number | null;
    changeReason?: string | null;
  }
) {
  const existing = await db.shiftTeamPriceHistory.findUnique({
    where: { id: params.historyId },
    select: {
      id: true,
      shiftTeamId: true,
    },
  });

  if (!existing) {
    throw new PriceHistoryError('Registro de histórico não encontrado.', 404);
  }

  const duplicate = await db.shiftTeamPriceHistory.findFirst({
    where: {
      shiftTeamId: existing.shiftTeamId,
      effectiveFrom: params.effectiveFrom,
      id: { not: params.historyId },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new PriceHistoryError('Já existe um valor cadastrado para esta vigência.');
  }

  const updated = await db.shiftTeamPriceHistory.update({
    where: { id: params.historyId },
    data: {
      shiftValue: params.shiftValue,
      effectiveFrom: params.effectiveFrom,
      updatedBy: params.updatedBy ?? null,
      changeReason: params.changeReason?.trim() || null,
    },
  });

  await syncCurrentTeamShiftValue(db, existing.shiftTeamId);

  return updated;
}

export async function createCustomPriceHistoryEntry(
  db: DbClient,
  params: {
    physiotherapistTeamId: number;
    customShiftValue: number | null;
    effectiveFrom: Date;
    createdBy?: number | null;
    changeReason?: string | null;
  }
) {
  const duplicate = await db.physiotherapistTeamPriceHistory.findFirst({
    where: {
      physiotherapistTeamId: params.physiotherapistTeamId,
      effectiveFrom: params.effectiveFrom,
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new PriceHistoryError('Já existe um valor cadastrado para esta vigência.');
  }

  const created = await db.physiotherapistTeamPriceHistory.create({
    data: {
      physiotherapistTeamId: params.physiotherapistTeamId,
      customShiftValue: params.customShiftValue,
      effectiveFrom: params.effectiveFrom,
      createdBy: params.createdBy ?? null,
      updatedBy: params.createdBy ?? null,
      changeReason: params.changeReason?.trim() || null,
    },
  });

  await syncCurrentCustomShiftValue(db, params.physiotherapistTeamId);

  return created;
}

export async function updateCustomPriceHistoryEntry(
  db: DbClient,
  params: {
    historyId: number;
    customShiftValue: number | null;
    effectiveFrom: Date;
    updatedBy?: number | null;
    changeReason?: string | null;
  }
) {
  const existing = await db.physiotherapistTeamPriceHistory.findUnique({
    where: { id: params.historyId },
    select: {
      id: true,
      physiotherapistTeamId: true,
    },
  });

  if (!existing) {
    throw new PriceHistoryError('Registro de histórico não encontrado.', 404);
  }

  const duplicate = await db.physiotherapistTeamPriceHistory.findFirst({
    where: {
      physiotherapistTeamId: existing.physiotherapistTeamId,
      effectiveFrom: params.effectiveFrom,
      id: { not: params.historyId },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new PriceHistoryError('Já existe um valor cadastrado para esta vigência.');
  }

  const updated = await db.physiotherapistTeamPriceHistory.update({
    where: { id: params.historyId },
    data: {
      customShiftValue: params.customShiftValue,
      effectiveFrom: params.effectiveFrom,
      updatedBy: params.updatedBy ?? null,
      changeReason: params.changeReason?.trim() || null,
    },
  });

  await syncCurrentCustomShiftValue(db, existing.physiotherapistTeamId);

  return updated;
}

export function serializePriceHistoryEntry<T extends {
  id: number;
  effectiveFrom: Date;
  createdAt: Date;
  updatedAt: Date;
  changeReason: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  user?: { name: string } | null;
  updatedByUser?: { name: string } | null;
}>(entry: T) {
  return {
    id: entry.id,
    effectiveFrom: entry.effectiveFrom.toISOString(),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    changeReason: entry.changeReason,
    createdBy: entry.createdBy ?? null,
    createdByName: entry.user?.name ?? null,
    updatedBy: entry.updatedBy ?? null,
    updatedByName: entry.updatedByUser?.name ?? null,
  };
}

export function serializeDecimalValue(value: Prisma.Decimal | number | null | undefined) {
  return toNumber(value);
}
