import { Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

export type PhysiotherapistTeamAssignmentInput =
  | number
  | string
  | {
      teamId: number | string;
      customShiftValue?: number | string | null;
    };

export interface NormalizedPhysiotherapistTeamAssignment {
  teamId: number;
  customShiftValue: number | null;
  customShiftValueProvided: boolean;
}

export class PhysiotherapistTeamSyncError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'PhysiotherapistTeamSyncError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function parseNumber(value: number | string, fieldName: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    throw new PhysiotherapistTeamSyncError(`Valor inválido para ${fieldName}.`, 400, {
      field: fieldName,
      value,
    });
  }

  return parsed;
}

function parsePositiveInteger(value: number | string, fieldName: string): number {
  const parsed = parseNumber(value, fieldName);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new PhysiotherapistTeamSyncError(`Valor inválido para ${fieldName}.`, 400, {
      field: fieldName,
      value,
    });
  }

  return parsed;
}

export function normalizePhysiotherapistTeamAssignments(
  teamIds: unknown
): NormalizedPhysiotherapistTeamAssignment[] {
  if (!Array.isArray(teamIds)) {
    throw new PhysiotherapistTeamSyncError('teamIds deve ser um array.', 400);
  }

  const seen = new Set<number>();

  return teamIds.map((item, index) => {
    if (typeof item === 'number' || typeof item === 'string') {
      const teamId = parsePositiveInteger(item, `teamIds[${index}]`);
      if (seen.has(teamId)) {
        throw new PhysiotherapistTeamSyncError('Lista de equipes contém IDs duplicados.', 400, {
          teamId,
        });
      }
      seen.add(teamId);
      return {
        teamId,
        customShiftValue: null,
        customShiftValueProvided: false,
      };
    }

    if (!item || typeof item !== 'object') {
      throw new PhysiotherapistTeamSyncError('Formato inválido em teamIds.', 400, {
        index,
        value: item,
      });
    }

    const rawTeamId = (item as { teamId?: number | string }).teamId;
    const teamId = parsePositiveInteger(rawTeamId as number | string, `teamIds[${index}].teamId`);

    if (seen.has(teamId)) {
      throw new PhysiotherapistTeamSyncError('Lista de equipes contém IDs duplicados.', 400, {
        teamId,
      });
    }
    seen.add(teamId);

    const hasCustomShiftValue = Object.prototype.hasOwnProperty.call(item, 'customShiftValue');
    const rawCustomShiftValue = (item as { customShiftValue?: number | string | null }).customShiftValue;

    if (!hasCustomShiftValue) {
      return {
        teamId,
        customShiftValue: null,
        customShiftValueProvided: false,
      };
    }

    if (rawCustomShiftValue === null || rawCustomShiftValue === '') {
      return {
        teamId,
        customShiftValue: null,
        customShiftValueProvided: true,
      };
    }

    const customShiftValue = parseNumber(rawCustomShiftValue as number | string, `teamIds[${index}].customShiftValue`);

    return {
      teamId,
      customShiftValue,
      customShiftValueProvided: true,
    };
  });
}

async function countFutureShiftsForTeam(
  db: DbClient,
  physiotherapistId: number,
  shiftTeamId: number
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return db.shift.count({
    where: {
      physiotherapistId,
      shiftTeamId,
      date: {
        gte: today,
      },
    },
  });
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

export async function syncPhysiotherapistTeamsByDiff(
  db: DbClient,
  physiotherapistId: number,
  teamAssignments: NormalizedPhysiotherapistTeamAssignment[],
  createdByUserId?: number | null
): Promise<{
  addedTeamIds: number[];
  reactivatedTeamIds: number[];
  updatedTeamIds: number[];
  removedTeamIds: number[];
}> {
  const existingTeams = await db.physiotherapistTeam.findMany({
    where: { physiotherapistId },
    select: {
      id: true,
      shiftTeamId: true,
      customShiftValue: true,
      isActive: true,
    },
  });

  const existingByTeamId = new Map(existingTeams.map((team) => [team.shiftTeamId, team]));
  const requestedTeamIds = new Set(teamAssignments.map((assignment) => assignment.teamId));
  const now = new Date();

  const teamsToRemove = existingTeams.filter((team) => team.isActive && !requestedTeamIds.has(team.shiftTeamId));
  const blockingRemovals = await Promise.all(
    teamsToRemove.map(async (team) => {
      const futureShifts = await countFutureShiftsForTeam(db, physiotherapistId, team.shiftTeamId);
      return futureShifts > 0
        ? {
            teamId: team.shiftTeamId,
            futureShifts,
          }
        : null;
    })
  );

  const blocked = blockingRemovals.filter(Boolean) as Array<{ teamId: number; futureShifts: number }>;
  if (blocked.length > 0) {
    throw new PhysiotherapistTeamSyncError(
      'Não é possível remover uma equipe com plantões futuros.',
      400,
      blocked
    );
  }

  const addedTeamIds: number[] = [];
  const reactivatedTeamIds: number[] = [];
  const updatedTeamIds: number[] = [];
  const removedTeamIds: number[] = [];

  for (const team of teamsToRemove) {
    await db.physiotherapistTeam.update({
      where: { id: team.id },
      data: {
        isActive: false,
      },
    });
    removedTeamIds.push(team.shiftTeamId);
  }

  for (const assignment of teamAssignments) {
    const existing = existingByTeamId.get(assignment.teamId);

    if (!existing) {
      const created = await db.physiotherapistTeam.create({
        data: {
          physiotherapistId,
          shiftTeamId: assignment.teamId,
          isActive: true,
          ...(assignment.customShiftValueProvided
            ? {
                customShiftValue: assignment.customShiftValue,
              }
            : {}),
        },
        select: {
          id: true,
        },
      });

      if (assignment.customShiftValueProvided) {
        await db.physiotherapistTeamPriceHistory.create({
          data: {
            physiotherapistTeamId: created.id,
            customShiftValue: assignment.customShiftValue,
            createdBy: createdByUserId ?? null,
            updatedBy: createdByUserId ?? null,
            effectiveFrom: now,
            changeReason: 'Valor customizado inicial do vínculo',
          },
        });
      }

      addedTeamIds.push(assignment.teamId);
      continue;
    }

    const currentCustomValue = decimalToNumber(existing.customShiftValue);
    const nextCustomValue = assignment.customShiftValueProvided
      ? assignment.customShiftValue
      : currentCustomValue;

    const shouldReactivate = !existing.isActive;
    const shouldUpdateCustom =
      assignment.customShiftValueProvided && currentCustomValue !== nextCustomValue;

    if (!shouldReactivate && !shouldUpdateCustom) {
      continue;
    }

    await db.physiotherapistTeam.update({
      where: { id: existing.id },
      data: {
        ...(shouldReactivate ? { isActive: true } : {}),
        ...(shouldUpdateCustom ? { customShiftValue: nextCustomValue } : {}),
      },
    });

    if (shouldReactivate) {
      reactivatedTeamIds.push(assignment.teamId);
    }

    if (shouldUpdateCustom) {
      updatedTeamIds.push(assignment.teamId);
      await db.physiotherapistTeamPriceHistory.create({
        data: {
          physiotherapistTeamId: existing.id,
          customShiftValue: nextCustomValue,
          createdBy: createdByUserId ?? null,
          updatedBy: createdByUserId ?? null,
          effectiveFrom: now,
          changeReason: 'Atualização direta do valor customizado',
        },
      });
    }
  }

  return {
    addedTeamIds,
    reactivatedTeamIds,
    updatedTeamIds,
    removedTeamIds,
  };
}
