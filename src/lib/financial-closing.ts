import crypto from 'crypto';
import fs from 'fs/promises';
import { ContractType, FinancialClosingLineStatus, Prisma } from '@prisma/client';

import { sendPaymentReceipt } from './gmail-sender';
import {
  FinancialAdjustmentType,
  FinancialAuditEventType,
  FinancialClosingLineSnapshot,
  FinancialClosingStatus,
  FinancialDocumentStatus,
  FinancialDocumentType,
  FinancialShiftSnapshot,
  FinancialTeamBreakdownSnapshot,
  PaymentBatchStatus,
} from './financial-types';
import {
  loadFinancialBatch,
} from './inter-payments';
import {
  uploadFinancialDocumentToDrive,
  type FinancialDocumentType as DriveFinancialDocumentType,
} from './financial-documents';
import { buildMonthlyShiftPaymentEntries, groupMonthlyShiftPaymentEntries } from './payment-calculator';
import { prisma } from './prisma';
import type { RPAData } from './rpa-parser';

type TransactionClient = Prisma.TransactionClient;

const detailedClosingInclude = {
  createdByUser: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  approvedByUser: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  lines: {
    include: {
      physiotherapist: {
        select: {
          id: true,
          name: true,
          email: true,
          contractType: true,
          status: true,
        },
      },
      adjustments: true,
      documents: true,
      auditEvents: true,
      paymentBatch: true,
    },
    orderBy: [{ physiotherapistName: 'asc' }],
  },
  adjustments: true,
  documents: true,
  auditEvents: {
    include: {
      actorUser: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  },
  paymentBatches: {
    include: {
      createdByUser: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      lines: true,
      auditEvents: true,
    },
    orderBy: [{ createdAt: 'asc' }],
  },
} satisfies Prisma.FinancialClosingInclude;

type DetailedFinancialClosing = Prisma.FinancialClosingGetPayload<{
  include: typeof detailedClosingInclude;
}>;

type ParsedReferenceMonth = {
  referenceMonth: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
};

type FinancialRpaExtractedData = RPAData & {
  parserStatus?: 'AUTO_OK' | 'AUTO_FAILED' | 'MANUAL_CONFIRMED';
  parserMessage?: string | null;
  manualOverride?: boolean;
  appliedToClosing?: boolean;
  appliedAt?: string | null;
  systemGrossValue?: number;
  grossDifference?: number;
  grossMismatch?: boolean;
  grossMismatchMessage?: string | null;
};

export type FinancialClosingAuditInput = {
  financialClosingId: number;
  type: FinancialAuditEventType;
  actorUserId?: number | null;
  actorName?: string | null;
  message?: string | null;
  details?: Prisma.InputJsonValue | null;
  financialClosingLineId?: number | null;
  financialAdjustmentId?: number | null;
  financialDocumentId?: number | null;
  paymentBatchId?: number | null;
};

export type FinancialAdjustmentInput = {
  financialClosingId: number;
  financialClosingLineId?: number | null;
  type: FinancialAdjustmentType;
  amount: number;
  reason: string;
  description?: string | null;
  source?: string;
  createdBy?: number | null;
};

export type FinancialDocumentInput = {
  financialClosingId: number;
  financialClosingLineId?: number | null;
  physiotherapistId?: number | null;
  type: FinancialDocumentType;
  fileName: string;
  fileId?: string | null;
  fileUrl?: string | null;
  mimeType?: string | null;
  fileHash?: string | null;
  folderPath?: string | null;
  referenceMonth: string;
  metadata?: Prisma.InputJsonValue | null;
  extractedData?: Prisma.InputJsonValue | null;
  status?: FinancialDocumentStatus;
  provider?: string;
  uploadedBy?: number | null;
  uploadedAt?: Date | null;
};

export type FinancialBatchInput = {
  financialClosingId: number;
  createdBy?: number | null;
  provider?: string;
  batchNumber?: string | null;
  fileName?: string | null;
  fileId?: string | null;
  fileHash?: string | null;
  payload?: Prisma.InputJsonValue | null;
};

export type FinancialBatchReceiptSyncResult = {
  batchId: string;
  referenceMonth: string;
  synced: number;
  skipped: number;
  documentIds: number[];
  receiptIds: string[];
};

export type FinancialBatchReceiptEmailResult = {
  batchId: string;
  receiptId: string;
  success: boolean;
  messageId?: string;
};

function assertReferenceMonth(referenceMonth: string) {
  if (!/^\d{4}-\d{2}$/.test(referenceMonth)) {
    throw new Error('Formato de mes invalido. Use YYYY-MM');
  }
}

function parseReferenceMonth(referenceMonth: string): ParsedReferenceMonth {
  assertReferenceMonth(referenceMonth);

  const [year, month] = referenceMonth.split('-').map(Number);
  return {
    referenceMonth,
    year,
    month,
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 1),
  };
}

function toDecimal(value: number | string | Prisma.Decimal | null | undefined) {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  if (value === null || value === undefined) {
    return new Prisma.Decimal(0);
  }

  return new Prisma.Decimal(value);
}

function decimalToNumber(value: number | string | Prisma.Decimal | null | undefined) {
  return Number(toDecimal(value));
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function hashPayload(payload: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRpaData(value: unknown): FinancialRpaExtractedData | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const readNumber = (field: keyof RPAData) => {
    const candidate = value[field];
    return typeof candidate === 'number' && Number.isFinite(candidate) ? roundCurrency(candidate) : 0;
  };

  const parserStatus = value.parserStatus;
  const parserMessage = value.parserMessage;
  const manualOverride = value.manualOverride;
  const appliedToClosing = value.appliedToClosing;
  const appliedAt = value.appliedAt;
  const systemGrossValue = value.systemGrossValue;
  const grossDifference = value.grossDifference;
  const grossMismatch = value.grossMismatch;
  const grossMismatchMessage = value.grossMismatchMessage;
  const textoExtraido = value.textoExtraido;

  return {
    valorServicoPrestado: readNumber('valorServicoPrestado'),
    outrosDescontos: readNumber('outrosDescontos'),
    iss: readNumber('iss'),
    irrf: readNumber('irrf'),
    inss: readNumber('inss'),
    totalDescontos: readNumber('totalDescontos'),
    valorLiquido: readNumber('valorLiquido'),
    textoExtraido: typeof textoExtraido === 'string' ? textoExtraido : undefined,
    parserStatus:
      parserStatus === 'AUTO_OK' || parserStatus === 'AUTO_FAILED' || parserStatus === 'MANUAL_CONFIRMED'
        ? parserStatus
        : undefined,
    parserMessage: typeof parserMessage === 'string' ? parserMessage : null,
    manualOverride: typeof manualOverride === 'boolean' ? manualOverride : undefined,
    appliedToClosing: typeof appliedToClosing === 'boolean' ? appliedToClosing : undefined,
    appliedAt: typeof appliedAt === 'string' ? appliedAt : null,
    systemGrossValue: typeof systemGrossValue === 'number' && Number.isFinite(systemGrossValue) ? roundCurrency(systemGrossValue) : undefined,
    grossDifference: typeof grossDifference === 'number' && Number.isFinite(grossDifference) ? roundCurrency(grossDifference) : undefined,
    grossMismatch: typeof grossMismatch === 'boolean' ? grossMismatch : undefined,
    grossMismatchMessage: typeof grossMismatchMessage === 'string' ? grossMismatchMessage : null,
  };
}

function buildRpaGrossComparison(
  systemGrossValue: number,
  serviceValueFromRpa: number
): Pick<FinancialRpaExtractedData, 'systemGrossValue' | 'grossDifference' | 'grossMismatch' | 'grossMismatchMessage'> {
  const normalizedSystemGross = roundCurrency(systemGrossValue);
  const normalizedRpaGross = roundCurrency(serviceValueFromRpa);
  const grossDifference = roundCurrency(normalizedRpaGross - normalizedSystemGross);
  const grossMismatch = normalizedRpaGross > 0 && Math.abs(grossDifference) >= 0.01;

  return {
    systemGrossValue: normalizedSystemGross,
    grossDifference,
    grossMismatch,
    grossMismatchMessage: grossMismatch
      ? `O bruto da RPA (${normalizedRpaGross.toFixed(2)}) difere do bruto calculado pelo sistema (${normalizedSystemGross.toFixed(2)}).`
      : null,
  };
}

function getDriveDocumentTypeFromBatchReceipt(kind: string): DriveFinancialDocumentType {
  if (kind === 'RPA') {
    return 'RPA';
  }

  if (kind === 'BANK_FILE') {
    return 'BANK_FILE';
  }

  if (kind === 'BANK_RETURN') {
    return 'BANK_RETURN';
  }

  if (kind === 'EMAIL_RECEIPT') {
    return 'OTHER';
  }

  return 'PIX_RECEIPT';
}

function resolveFinancialClosingLineByPhysiotherapist(
  closing: DetailedFinancialClosing,
  physiotherapistId: number | null | undefined,
  physiotherapistName: string
) {
  if (physiotherapistId) {
    const byId = closing.lines.find((line) => line.physiotherapistId === physiotherapistId);
    if (byId) {
      return byId;
    }
  }

  return closing.lines.find((line) => line.physiotherapistName === physiotherapistName) ?? null;
}

function mapTeamBreakdown(summary: ReturnType<typeof groupMonthlyShiftPaymentEntries>[number]): FinancialTeamBreakdownSnapshot[] {
  return [...summary.teamBreakdown.values()].map((team) => ({
    teamId: team.teamId,
    teamName: team.teamName,
    periods: team.periods,
    totalShifts: team.totalShifts,
    totalValue: team.totalValue,
    shiftValues: team.shiftValues,
  }));
}

function buildShiftDetailsSnapshot(
  summary: ReturnType<typeof groupMonthlyShiftPaymentEntries>[number]
): FinancialShiftSnapshot[] {
  return summary.shiftDetails.map((entry) => ({
    shiftId: entry.shiftId,
    date: entry.date.toISOString(),
    period: entry.period,
    teamId: entry.teamId,
    teamName: entry.teamName,
    shiftValue: entry.shiftValue,
    additionalValue: entry.additionalValue,
  }));
}

function buildLineSnapshot(
  summary: ReturnType<typeof groupMonthlyShiftPaymentEntries>[number]
): FinancialClosingLineSnapshot {
  const teamBreakdowns = mapTeamBreakdown(summary);
  const primaryTeam = teamBreakdowns
    .slice()
    .sort((a, b) => b.totalValue - a.totalValue || b.totalShifts - a.totalShifts)[0] ?? null;

  const shiftDetails = buildShiftDetailsSnapshot(summary);
  const netValue = summary.grossValue;

  return {
    physiotherapistId: summary.physiotherapistId,
    physiotherapistName: summary.physiotherapistName,
    physiotherapistEmail: summary.email || '',
    contractType: summary.contractType,
    primaryTeamId: primaryTeam?.teamId ?? null,
    primaryTeamName: primaryTeam?.teamName ?? null,
    totalShifts: summary.totalShifts,
    grossCalculatedValue: summary.grossValue,
    adjustmentTotalValue: 0,
    additionalValue: summary.additionalValue,
    netValue,
    teamBreakdowns,
    shiftDetails,
  };
}

function buildSnapshotData(referenceMonth: string, lines: FinancialClosingLineSnapshot[]) {
  const parsed = parseReferenceMonth(referenceMonth);
  const totals = lines.reduce(
    (acc, line) => {
      acc.totalShifts += line.totalShifts;
      acc.totalGrossValue += line.grossCalculatedValue;
      acc.totalAdjustmentValue += line.adjustmentTotalValue;
      acc.totalNetValue += line.netValue;
      return acc;
    },
    {
      totalShifts: 0,
      totalGrossValue: 0,
      totalAdjustmentValue: 0,
      totalNetValue: 0,
    }
  );

  return {
    referenceMonth,
    year: parsed.year,
    month: parsed.month,
    totalPhysiotherapists: lines.length,
    totalShifts: totals.totalShifts,
    totalGrossValue: totals.totalGrossValue,
    totalAdjustmentValue: totals.totalAdjustmentValue,
    totalNetValue: totals.totalNetValue,
    sourceChecksum: hashPayload({
      referenceMonth,
      lines,
    }),
    generatedAt: new Date().toISOString(),
    lines,
  };
}

async function findClosingByMonth(referenceMonth: string) {
  return prisma.financialClosing.findUnique({
    where: { referenceMonth },
    include: detailedClosingInclude,
  });
}

export async function getFinancialClosingByMonth(referenceMonth: string): Promise<DetailedFinancialClosing | null> {
  assertReferenceMonth(referenceMonth);
  return findClosingByMonth(referenceMonth);
}

export async function getFinancialClosingById(id: number): Promise<DetailedFinancialClosing | null> {
  return prisma.financialClosing.findUnique({
    where: { id },
    include: detailedClosingInclude,
  });
}

export async function getFinancialClosingSummary(referenceMonth: string) {
  const closing = await getFinancialClosingByMonth(referenceMonth);

  if (!closing) {
    return null;
  }

  const byPerson = closing.lines.map((line) => ({
    lineId: line.id,
    physiotherapistId: line.physiotherapistId,
    name: line.physiotherapistName,
    email: line.physiotherapistEmail ?? null,
    contractType: line.contractType,
    totalShifts: line.totalShifts,
    calculatedGrossValue: decimalToNumber(line.grossCalculatedValue),
    totalAdjustments: decimalToNumber(line.adjustmentTotalValue),
    finalNetValue: decimalToNumber(line.netValue),
    status: line.status,
  }));

  const byTeamMap = new Map<number, { teamId: number; teamName: string; totalShifts: number; totalValue: number }>();

  for (const line of closing.lines) {
    const teamBreakdowns = Array.isArray(line.teamBreakdownSnapshot)
      ? (line.teamBreakdownSnapshot as unknown as Array<FinancialTeamBreakdownSnapshot>)
      : [];

    for (const team of teamBreakdowns) {
      const current = byTeamMap.get(team.teamId) ?? {
        teamId: team.teamId,
        teamName: team.teamName,
        totalShifts: 0,
        totalValue: 0,
      };

      current.totalShifts += team.totalShifts;
      current.totalValue += team.totalValue;
      byTeamMap.set(team.teamId, current);
    }
  }

  return {
    month: closing.referenceMonth,
    status: closing.status,
    totals: {
      grossValue: decimalToNumber(closing.totalGrossValue),
      adjustments: decimalToNumber(closing.totalAdjustmentValue),
      netValue: decimalToNumber(closing.totalNetValue),
      professionals: closing.totalPhysiotherapists,
    },
    byPerson,
    byTeam: [...byTeamMap.values()].sort((a, b) => a.teamName.localeCompare(b.teamName)),
  };
}

export async function ensureFinancialClosing(
  referenceMonth: string,
  options: {
    createdByUserId?: number | null;
    notes?: string | null;
    force?: boolean;
  } = {}
): Promise<DetailedFinancialClosing> {
  const parsed = parseReferenceMonth(referenceMonth);
  const existing = await findClosingByMonth(referenceMonth);

  if (existing && existing.lines.length > 0 && !options.force) {
    return existing;
  }

  const entries = await buildMonthlyShiftPaymentEntries(referenceMonth);
  const summaries = groupMonthlyShiftPaymentEntries(entries);
  const lineSnapshots = summaries.map((summary) => buildLineSnapshot(summary));
  const snapshotData = buildSnapshotData(referenceMonth, lineSnapshots);

  const closing = await prisma.$transaction(async (tx) => {
    let closingId = existing?.id ?? null;
    let snapshotVersion = existing?.snapshotVersion ?? 1;
    let createdBy = existing?.createdBy ?? options.createdByUserId ?? null;
    let notes = existing?.notes ?? options.notes ?? null;

    if (!closingId) {
      const created = await tx.financialClosing.create({
        data: {
          referenceMonth,
          year: parsed.year,
          month: parsed.month,
          status: 'DRAFT',
          snapshotVersion,
          createdBy,
          notes,
          generatedAt: new Date(),
          totalPhysiotherapists: snapshotData.totalPhysiotherapists,
          totalShifts: snapshotData.totalShifts,
          totalGrossValue: toDecimal(snapshotData.totalGrossValue),
          totalAdjustmentValue: toDecimal(snapshotData.totalAdjustmentValue),
          totalNetValue: toDecimal(snapshotData.totalNetValue),
          sourceChecksum: snapshotData.sourceChecksum,
          snapshotData: toJsonInput(snapshotData),
        },
      });
      closingId = created.id;
      snapshotVersion = created.snapshotVersion;
      createdBy = created.createdBy;
      notes = created.notes;
    } else {
      snapshotVersion = options.force ? snapshotVersion + 1 : snapshotVersion;
      await tx.financialClosing.update({
        where: { id: closingId },
        data: {
          year: parsed.year,
          month: parsed.month,
          snapshotVersion,
          createdBy,
          notes,
          generatedAt: new Date(),
          totalPhysiotherapists: snapshotData.totalPhysiotherapists,
          totalShifts: snapshotData.totalShifts,
          totalGrossValue: toDecimal(snapshotData.totalGrossValue),
          totalAdjustmentValue: toDecimal(snapshotData.totalAdjustmentValue),
          totalNetValue: toDecimal(snapshotData.totalNetValue),
          sourceChecksum: snapshotData.sourceChecksum,
          snapshotData: toJsonInput(snapshotData),
        },
      });

      if (options.force) {
        await tx.financialAuditEvent.deleteMany({
          where: { financialClosingId: closingId },
        });
        await tx.financialClosingLine.deleteMany({
          where: { financialClosingId: closingId },
        });
        await tx.financialAdjustment.deleteMany({
          where: { financialClosingId: closingId },
        });
        await tx.financialDocument.deleteMany({
          where: { financialClosingId: closingId },
        });
        await tx.paymentBatch.deleteMany({
          where: { financialClosingId: closingId },
        });
      }
    }

    if (lineSnapshots.length > 0) {
      await tx.financialClosingLine.createMany({
        data: lineSnapshots.map((line: FinancialClosingLineSnapshot) => ({
          financialClosingId: closingId!,
          physiotherapistId: line.physiotherapistId,
          primaryTeamId: line.primaryTeamId,
          primaryTeamName: line.primaryTeamName,
          physiotherapistName: line.physiotherapistName,
          physiotherapistEmail: line.physiotherapistEmail || null,
          contractType: line.contractType,
          totalShifts: line.totalShifts,
          grossCalculatedValue: toDecimal(line.grossCalculatedValue),
          adjustmentTotalValue: toDecimal(line.adjustmentTotalValue),
          netValue: toDecimal(line.netValue),
          additionalValue: toDecimal(line.additionalValue),
          calculationSnapshot: {
            grossCalculatedValue: line.grossCalculatedValue,
            adjustmentTotalValue: line.adjustmentTotalValue,
            additionalValue: line.additionalValue,
            netValue: line.netValue,
            totalShifts: line.totalShifts,
          } as unknown as Prisma.InputJsonValue,
          shiftDetailsSnapshot: toJsonInput(line.shiftDetails),
          teamBreakdownSnapshot: toJsonInput(line.teamBreakdowns),
          status: 'DRAFT',
          createdBy: options.createdByUserId ?? null,
          updatedBy: options.createdByUserId ?? null,
        })),
      });
    }

    await tx.financialAuditEvent.create({
      data: {
        financialClosingId: closingId!,
        type: 'SNAPSHOT_CREATED',
        actorUserId: options.createdByUserId ?? null,
        message: 'Fechamento financeiro gerado a partir do calculador mensal.',
        details: toJsonInput(snapshotData),
      },
    });

    return closingId!;
  });

  const refreshed = await findClosingByMonth(referenceMonth);
  if (!refreshed) {
    throw new Error('Nao foi possivel gerar o fechamento financeiro.');
  }

  return refreshed;
}

export async function updateFinancialClosingStatus(
  referenceMonth: string,
  status: FinancialClosingStatus,
  actorUserId?: number | null,
  actorName?: string | null,
  message?: string | null
): Promise<DetailedFinancialClosing> {
  const closing = await ensureFinancialClosing(referenceMonth, {
    createdByUserId: actorUserId ?? null,
  });
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (status === 'APPROVED_FOR_PAYMENT') {
      await tx.financialClosingLine.updateMany({
        where: {
          financialClosingId: closing.id,
          status: {
            notIn: ['PAID', 'CANCELLED'],
          },
        },
        data: {
          status: 'APPROVED',
          approvedAt: now,
          updatedBy: actorUserId ?? null,
        },
      });
    }

    if (status === 'UNDER_REVIEW' || status === 'REOPENED') {
      await tx.financialClosingLine.updateMany({
        where: {
          financialClosingId: closing.id,
          status: {
            notIn: ['PAID', 'CANCELLED'],
          },
        },
        data: {
          status: 'UNDER_REVIEW',
          updatedBy: actorUserId ?? null,
        },
      });
    }

    await tx.financialClosing.update({
      where: { id: closing.id },
      data: {
        status,
        approvedBy: status === 'APPROVED_FOR_PAYMENT' ? actorUserId ?? null : closing.approvedBy,
        approvedAt: status === 'APPROVED_FOR_PAYMENT' ? now : closing.approvedAt,
        lockedAt: ['BANK_FILE_GENERATED', 'BANK_SUBMITTED', 'PAYMENT_CONFIRMED', 'CLOSED'].includes(status)
          ? now
          : closing.lockedAt,
        closedAt: status === 'CLOSED' ? now : closing.closedAt,
        reopenedAt: status === 'REOPENED' ? now : closing.reopenedAt,
      },
    });

    await tx.financialAuditEvent.create({
      data: {
        financialClosingId: closing.id,
        type: status === 'REOPENED' ? 'REOPENED' : 'STATUS_CHANGED',
        actorUserId: actorUserId ?? null,
        actorName: actorName ?? null,
        message: message ?? `Status do fechamento alterado para ${status}.`,
      details: {
        previousStatus: closing.status,
        nextStatus: status,
      } as unknown as Prisma.InputJsonValue,
      },
    });
  });

  const refreshed = await findClosingByMonth(referenceMonth);
  if (!refreshed) {
    throw new Error('Nao foi possivel atualizar o status do fechamento.');
  }

  return refreshed;
}

export async function updateFinancialClosingLineStatus(
  referenceMonth: string,
  lineId: number,
  status: FinancialClosingLineStatus,
  actorUserId?: number | null,
  notes?: string | null
) {
  const closing = await ensureFinancialClosing(referenceMonth, {
    createdByUserId: actorUserId ?? null,
  });

  const line = await prisma.financialClosingLine.findFirst({
    where: {
      id: lineId,
      financialClosingId: closing.id,
    },
  });

  if (!line) {
    throw new Error('Linha do fechamento nao encontrada.');
  }

  if (status === 'APPROVED') {
    if (line.contractType === ContractType.RPA) {
      const rpaDocument = await prisma.financialDocument.findFirst({
        where: {
          financialClosingId: closing.id,
          financialClosingLineId: line.id,
          type: 'RPA',
          status: {
            not: 'INVALID',
          },
        },
        orderBy: [{ uploadedAt: 'desc' }, { createdAt: 'desc' }],
      });

      if (!rpaDocument) {
        throw new Error('Esta linha RPA precisa ter os valores da RPA preenchidos antes da aprovação. O anexo pode ser feito depois.');
      }

      const extracted = normalizeRpaData(rpaDocument.extractedData);
      if (!extracted || !Number.isFinite(extracted.valorLiquido) || extracted.valorLiquido <= 0) {
        throw new Error('Esta linha RPA precisa ter o valor líquido preenchido ou confirmado manualmente antes da aprovação.');
      }
    }
  }

  const now = new Date();

  const updatedLine = await prisma.financialClosingLine.update({
    where: { id: lineId },
    data: {
      status,
      approvedAt: status === 'APPROVED' ? now : line.approvedAt,
      lockedAt: status === 'LOCKED' ? now : line.lockedAt,
      paidAt: status === 'PAID' ? now : line.paidAt,
      updatedBy: actorUserId ?? null,
    },
  });

  await prisma.financialAuditEvent.create({
    data: {
      financialClosingId: closing.id,
      financialClosingLineId: lineId,
      type: 'STATUS_CHANGED',
      actorUserId: actorUserId ?? null,
      message: notes ?? `Status da linha alterado para ${status}.`,
      details: {
        previousStatus: line.status,
        nextStatus: status,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return updatedLine;
}

export async function recordFinancialAuditEvent(input: FinancialClosingAuditInput) {
  return prisma.financialAuditEvent.create({
    data: {
      financialClosingId: input.financialClosingId,
      financialClosingLineId: input.financialClosingLineId ?? null,
      financialAdjustmentId: input.financialAdjustmentId ?? null,
      financialDocumentId: input.financialDocumentId ?? null,
      paymentBatchId: input.paymentBatchId ?? null,
      type: input.type,
      actorUserId: input.actorUserId ?? null,
      actorName: input.actorName ?? null,
      message: input.message ?? null,
      details: input.details ?? undefined,
    },
  });
}

export async function registerFinancialAdjustment(input: FinancialAdjustmentInput) {
  const closing = await prisma.financialClosing.findUnique({
    where: { id: input.financialClosingId },
    include: { lines: true },
  });

  if (!closing) {
    throw new Error('Fechamento financeiro nao encontrado.');
  }

  if (closing.status === 'CLOSED') {
    throw new Error('Fechamento fechado nao pode receber ajustes.');
  }

  const amount = toDecimal(input.amount);
  if (amount.isZero()) {
    throw new Error('O valor do ajuste precisa ser diferente de zero.');
  }

  const adjustment = await prisma.$transaction(async (tx) => {
    const created = await tx.financialAdjustment.create({
      data: {
        financialClosingId: input.financialClosingId,
        financialClosingLineId: input.financialClosingLineId ?? null,
        type: input.type,
        amount,
        reason: input.reason,
        description: input.description ?? null,
        source: input.source ?? 'MANUAL',
        createdBy: input.createdBy ?? null,
      },
    });

    if (input.financialClosingLineId) {
      await tx.financialClosingLine.update({
        where: { id: input.financialClosingLineId },
        data: {
          adjustmentTotalValue: {
            increment: amount,
          },
          netValue: {
            increment: amount,
          },
          status: 'UNDER_REVIEW',
          updatedBy: input.createdBy ?? null,
        },
      });
    }

    await tx.financialClosing.update({
      where: { id: input.financialClosingId },
      data: {
        totalAdjustmentValue: {
          increment: amount,
        },
        totalNetValue: {
          increment: amount,
        },
        status: 'UNDER_REVIEW',
      },
    });

    await tx.financialAuditEvent.create({
      data: {
        financialClosingId: input.financialClosingId,
        financialClosingLineId: input.financialClosingLineId ?? null,
        financialAdjustmentId: created.id,
        type: 'ADJUSTMENT_CREATED',
        actorUserId: input.createdBy ?? null,
        message: input.reason,
        details: {
          type: input.type,
          amount: Number(amount),
          description: input.description ?? null,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return created;
  });

  return adjustment;
}

export async function registerFinancialDocument(input: FinancialDocumentInput) {
  const closing = await prisma.financialClosing.findUnique({
    where: { id: input.financialClosingId },
  });

  if (!closing) {
    throw new Error('Fechamento financeiro nao encontrado.');
  }

  return prisma.$transaction(async (tx) => {
    const document = await tx.financialDocument.create({
      data: {
        financialClosingId: input.financialClosingId,
        financialClosingLineId: input.financialClosingLineId ?? null,
        physiotherapistId: input.physiotherapistId ?? null,
        type: input.type,
        status: input.status ?? 'PENDING',
        provider: input.provider ?? 'GOOGLE_DRIVE',
        fileName: input.fileName,
        fileId: input.fileId ?? null,
        fileUrl: input.fileUrl ?? null,
        mimeType: input.mimeType ?? null,
        fileHash: input.fileHash ?? null,
        folderPath: input.folderPath ?? null,
        referenceMonth: input.referenceMonth,
        metadata: input.metadata ?? undefined,
        extractedData: input.extractedData ?? undefined,
        uploadedBy: input.uploadedBy ?? null,
        uploadedAt: input.uploadedAt ?? new Date(),
      },
    });

    await tx.financialAuditEvent.create({
      data: {
        financialClosingId: input.financialClosingId,
        financialClosingLineId: input.financialClosingLineId ?? null,
        financialDocumentId: document.id,
        type: 'DOCUMENT_REGISTERED',
        actorUserId: input.uploadedBy ?? null,
        message: `Documento financeiro registrado: ${input.fileName}.`,
        details: {
          type: input.type,
          fileName: input.fileName,
          fileId: input.fileId ?? null,
          fileUrl: input.fileUrl ?? null,
          referenceMonth: input.referenceMonth,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return document;
  });
}

export async function syncFinancialRpaDocument(
  documentId: number,
  options: {
    actorUserId?: number | null;
    rpaData: Partial<RPAData> | null;
    parserStatus: 'AUTO_OK' | 'AUTO_FAILED' | 'MANUAL_CONFIRMED';
    parserMessage?: string | null;
    manualOverride?: boolean;
    applyToClosing?: boolean;
  }
) {
  const document = await prisma.financialDocument.findUnique({
    where: { id: documentId },
    include: {
      financialClosing: true,
      financialClosingLine: {
        include: {
          adjustments: true,
        },
      },
    },
  });

  if (!document) {
    throw new Error('Documento financeiro nao encontrado.');
  }

  if (document.type !== 'RPA') {
    throw new Error('A sincronizacao de RPA so pode ser usada em documentos RPA.');
  }

  const currentExtracted = normalizeRpaData(document.extractedData);
  const incoming = normalizeRpaData({
    ...currentExtracted,
    ...(options.rpaData ?? {}),
    parserStatus: options.parserStatus,
    parserMessage: options.parserMessage ?? null,
    manualOverride: options.manualOverride ?? false,
  });

  if (!incoming) {
    throw new Error('Nao foi possivel interpretar os dados da RPA.');
  }

  const line = document.financialClosingLine;
  const shouldApply = Boolean(options.applyToClosing) && !!line && Number.isFinite(incoming.valorLiquido);
  const now = new Date();
  const grossComparison = line
    ? buildRpaGrossComparison(decimalToNumber(line.grossCalculatedValue), incoming.valorServicoPrestado)
    : {
        systemGrossValue: undefined,
        grossDifference: undefined,
        grossMismatch: undefined,
        grossMismatchMessage: null,
      };

  const result = await prisma.$transaction(async (tx) => {
    let appliedAdjustment = 0;

    if (shouldApply && line) {
      const currentLine = await tx.financialClosingLine.findUnique({
        where: { id: line.id },
        include: { adjustments: true },
      });

      if (!currentLine) {
        throw new Error('Linha financeira vinculada ao documento nao encontrada.');
      }

      const existingRpaAdjustment = currentLine.adjustments.find((adjustment) => adjustment.source === 'RPA_DOCUMENT') ?? null;
      const otherAdjustments = currentLine.adjustments
        .filter((adjustment) => adjustment.source !== 'RPA_DOCUMENT')
        .reduce((sum, adjustment) => sum + decimalToNumber(adjustment.amount), 0);

      const desiredAdjustment = roundCurrency(
        incoming.valorLiquido - decimalToNumber(currentLine.grossCalculatedValue) - otherAdjustments
      );
      const currentAdjustment = existingRpaAdjustment ? decimalToNumber(existingRpaAdjustment.amount) : 0;
      const delta = roundCurrency(desiredAdjustment - currentAdjustment);

      if (existingRpaAdjustment && desiredAdjustment === 0) {
        await tx.financialAdjustment.delete({
          where: { id: existingRpaAdjustment.id },
        });
      } else if (existingRpaAdjustment) {
        await tx.financialAdjustment.update({
          where: { id: existingRpaAdjustment.id },
          data: {
            amount: toDecimal(desiredAdjustment),
            type: desiredAdjustment < 0 ? 'DISCOUNT' : 'CORRECTION',
            reason: 'Valor liquido definido a partir da RPA.',
            description: incoming.manualOverride
              ? 'Ajuste da RPA preenchido manualmente.'
              : 'Ajuste da RPA aplicado automaticamente pela leitura do documento.',
            createdBy: options.actorUserId ?? null,
          },
        });
      } else if (desiredAdjustment !== 0) {
        await tx.financialAdjustment.create({
          data: {
            financialClosingId: document.financialClosingId,
            financialClosingLineId: currentLine.id,
            type: desiredAdjustment < 0 ? 'DISCOUNT' : 'CORRECTION',
            amount: toDecimal(desiredAdjustment),
            reason: 'Valor liquido definido a partir da RPA.',
            description: incoming.manualOverride
              ? 'Ajuste da RPA preenchido manualmente.'
              : 'Ajuste da RPA aplicado automaticamente pela leitura do documento.',
            source: 'RPA_DOCUMENT',
            createdBy: options.actorUserId ?? null,
          },
        });
      }

      if (delta !== 0) {
        await tx.financialClosingLine.update({
          where: { id: currentLine.id },
          data: {
            adjustmentTotalValue: {
              increment: toDecimal(delta),
            },
            netValue: {
              increment: toDecimal(delta),
            },
            status: 'UNDER_REVIEW',
            updatedBy: options.actorUserId ?? null,
          },
        });

        await tx.financialClosing.update({
          where: { id: document.financialClosingId },
          data: {
            totalAdjustmentValue: {
              increment: toDecimal(delta),
            },
            totalNetValue: {
              increment: toDecimal(delta),
            },
            status: 'UNDER_REVIEW',
          },
        });
      }

      appliedAdjustment = desiredAdjustment;

      await tx.financialAuditEvent.create({
        data: {
          financialClosingId: document.financialClosingId,
          financialClosingLineId: currentLine.id,
          financialDocumentId: document.id,
          actorUserId: options.actorUserId ?? null,
          type: 'AUDIT_NOTE',
          message: incoming.manualOverride
            ? 'Dados da RPA informados manualmente e aplicados ao fechamento.'
            : 'Dados da RPA lidos automaticamente e aplicados ao fechamento.',
          details: {
            valorLiquido: incoming.valorLiquido,
            totalDescontos: incoming.totalDescontos,
            valorServicoPrestado: incoming.valorServicoPrestado,
            adjustmentAmount: desiredAdjustment,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      if (grossComparison.grossMismatch) {
        await tx.financialAuditEvent.create({
          data: {
            financialClosingId: document.financialClosingId,
            financialClosingLineId: currentLine.id,
            financialDocumentId: document.id,
            actorUserId: options.actorUserId ?? null,
            type: 'AUDIT_NOTE',
            message: 'Divergencia entre o bruto da RPA e o bruto calculado pelo sistema.',
            details: {
              systemGrossValue: grossComparison.systemGrossValue,
              rpaGrossValue: incoming.valorServicoPrestado,
              grossDifference: grossComparison.grossDifference,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    const updatedDocument = await tx.financialDocument.update({
      where: { id: document.id },
      data: {
        status: document.fileId ? 'AVAILABLE' : document.status,
        extractedData: toJsonInput({
          ...incoming,
          ...grossComparison,
          parserStatus: options.parserStatus,
          parserMessage: options.parserMessage ?? null,
          manualOverride: options.manualOverride ?? false,
          appliedToClosing: shouldApply,
          appliedAt: shouldApply ? now.toISOString() : null,
        }),
      },
    });

    return {
      document: updatedDocument,
      appliedAdjustment,
      appliedToClosing: shouldApply,
    };
  });

  return result;
}

export async function upsertManualFinancialRpaData(
  referenceMonth: string,
  lineId: number,
  options: {
    actorUserId?: number | null;
    rpaData: Partial<RPAData>;
    applyToClosing?: boolean;
  }
) {
  const closing = await ensureFinancialClosing(referenceMonth, {
    createdByUserId: options.actorUserId ?? null,
  });

  const line = await prisma.financialClosingLine.findFirst({
    where: {
      id: lineId,
      financialClosingId: closing.id,
    },
  });

  if (!line) {
    throw new Error('Linha do fechamento nao encontrada.');
  }

  if (line.contractType !== ContractType.RPA) {
    throw new Error('Valores manuais de RPA so podem ser informados para contratos RPA.');
  }

  let document = await prisma.financialDocument.findFirst({
    where: {
      financialClosingId: closing.id,
      financialClosingLineId: line.id,
      type: 'RPA',
    },
    orderBy: [{ uploadedAt: 'desc' }, { createdAt: 'desc' }],
  });

  if (!document) {
    document = await registerFinancialDocument({
      financialClosingId: closing.id,
      financialClosingLineId: line.id,
      physiotherapistId: line.physiotherapistId,
      type: 'RPA',
      status: 'PENDING',
      provider: 'MANUAL_ENTRY',
      fileName: `RPA pendente - ${line.physiotherapistName} - ${referenceMonth}`,
      referenceMonth,
      metadata: {
        pendingAttachment: true,
        createdFrom: 'manual_rpa_editor',
      } as unknown as Prisma.InputJsonValue,
      extractedData: {
        parserStatus: 'MANUAL_CONFIRMED',
        parserMessage: 'Valores da RPA preenchidos manualmente antes do anexo do documento.',
        manualOverride: true,
      } as unknown as Prisma.InputJsonValue,
      uploadedBy: options.actorUserId ?? null,
      uploadedAt: new Date(),
    });
  }

  const synced = await syncFinancialRpaDocument(document.id, {
    actorUserId: options.actorUserId ?? null,
    rpaData: options.rpaData,
    parserStatus: 'MANUAL_CONFIRMED',
    parserMessage: document.fileId
      ? 'Valores da RPA preenchidos manualmente.'
      : 'Valores da RPA preenchidos manualmente; anexo do documento ainda pendente.',
    manualOverride: true,
    applyToClosing: options.applyToClosing ?? true,
  });

  if (!document.fileId) {
    await prisma.financialDocument.update({
      where: { id: document.id },
      data: {
        metadata: {
          pendingAttachment: true,
          createdFrom: 'manual_rpa_editor',
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return synced;
}

export async function createPaymentBatch(input: FinancialBatchInput) {
  const closing = await prisma.financialClosing.findUnique({
    where: { id: input.financialClosingId },
    include: { lines: true },
  });

  if (!closing) {
    throw new Error('Fechamento financeiro nao encontrado.');
  }

  const approvedLines = closing.lines.filter((line) => line.status === 'APPROVED');

  if (approvedLines.length === 0) {
    throw new Error('Nao ha linhas aprovadas para gerar lote bancario.');
  }

  const totalValue = approvedLines.reduce((sum, line) => sum.add(line.netValue), new Prisma.Decimal(0));
  const payload = input.payload ?? {
    financialClosingId: input.financialClosingId,
    provider: input.provider ?? 'BANCO_INTER',
    referenceMonth: closing.referenceMonth,
    items: approvedLines.map((line) => ({
      lineId: line.id,
      physiotherapistId: line.physiotherapistId,
      physiotherapistName: line.physiotherapistName,
      physiotherapistEmail: line.physiotherapistEmail,
      contractType: line.contractType,
      primaryTeamId: line.primaryTeamId,
      primaryTeamName: line.primaryTeamName,
      totalShifts: line.totalShifts,
      grossCalculatedValue: decimalToNumber(line.grossCalculatedValue),
      adjustmentTotalValue: decimalToNumber(line.adjustmentTotalValue),
      netValue: decimalToNumber(line.netValue),
    })),
  };

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.paymentBatch.create({
      data: {
        financialClosingId: input.financialClosingId,
        provider: input.provider ?? 'BANCO_INTER',
        status: 'READY',
        batchNumber: input.batchNumber ?? null,
        fileName: input.fileName ?? null,
        fileId: input.fileId ?? null,
        fileHash: input.fileHash ?? null,
        recordCount: approvedLines.length,
        totalValue,
        payload: toJsonInput(payload),
        generatedAt: new Date(),
        createdBy: input.createdBy ?? null,
      },
    });

    await tx.financialClosingLine.updateMany({
      where: {
        id: {
          in: approvedLines.map((line) => line.id),
        },
      },
      data: {
        paymentBatchId: created.id,
        status: 'LOCKED',
        lockedAt: new Date(),
      },
    });

    await tx.financialClosing.update({
      where: { id: input.financialClosingId },
      data: {
        status: 'BANK_FILE_GENERATED',
        lockedAt: new Date(),
      },
    });

    await tx.financialAuditEvent.create({
      data: {
        financialClosingId: input.financialClosingId,
        paymentBatchId: created.id,
        type: 'BATCH_CREATED',
        actorUserId: input.createdBy ?? null,
        message: 'Lote bancario preparado a partir das linhas aprovadas.',
        details: {
          provider: input.provider ?? 'BANCO_INTER',
          recordCount: approvedLines.length,
          totalValue: decimalToNumber(totalValue),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return created;
  });

  return batch;
}

export async function syncPaymentBatchReceiptsToClosing(
  referenceMonth: string,
  batchId: string,
  actorUserId?: number | null
): Promise<FinancialBatchReceiptSyncResult> {
  const manifest = await loadFinancialBatch(batchId);

  if (!manifest) {
    throw new Error('Lote financeiro nao encontrado.');
  }

  const closing = await ensureFinancialClosing(referenceMonth, {
    createdByUserId: actorUserId ?? null,
  });

  let synced = 0;
  let skipped = 0;
  const documentIds: number[] = [];
  const receiptIds: string[] = [];

  for (const receipt of manifest.receipts) {
    if (!receipt.filePath) {
      skipped += 1;
      continue;
    }

    const fileBuffer = await fs.readFile(receipt.filePath).catch(() => null);
    if (!fileBuffer || fileBuffer.byteLength === 0) {
      skipped += 1;
      continue;
    }

    const physiotherapist = manifest.payments.find(
      (payment) => payment.physiotherapistId === receipt.physiotherapistId
    );

    const physiotherapistName = receipt.physiotherapistName || physiotherapist?.physiotherapistName || 'Fisioterapeuta';
    const physiotherapistId = receipt.physiotherapistId || physiotherapist?.physiotherapistId || null;
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const existing = await prisma.financialDocument.findFirst({
      where: {
        financialClosingId: closing.id,
        type: 'PIX_RECEIPT',
        fileHash,
      },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const uploaded = await uploadFinancialDocumentToDrive({
      buffer: Buffer.from(fileBuffer),
      fileName: receipt.fileName,
      mimeType: receipt.mimeType || 'application/pdf',
      physiotherapistName,
      competence: referenceMonth,
      documentType: getDriveDocumentTypeFromBatchReceipt(receipt.kind || 'PIX_RECEIPT'),
      source: receipt.source === 'INTER_API' ? 'bank_api' : 'system',
    });

    const line = resolveFinancialClosingLineByPhysiotherapist(closing, physiotherapistId, physiotherapistName);
    const now = new Date();

    if (line) {
      await prisma.financialClosingLine.update({
        where: { id: line.id },
        data: {
          status: 'PAID',
          paidAt: now,
          updatedBy: actorUserId ?? null,
        },
      });
    }

    const document = await registerFinancialDocument({
      financialClosingId: closing.id,
      financialClosingLineId: line?.id ?? null,
      physiotherapistId,
      type: 'PIX_RECEIPT',
      status: 'AVAILABLE',
      fileName: uploaded.fileName,
      fileId: uploaded.fileId,
      fileUrl: uploaded.webViewLink,
      mimeType: receipt.mimeType || 'application/pdf',
      fileHash,
      folderPath: uploaded.folderPath?.join(' / ') || null,
      referenceMonth,
      metadata: {
        source: receipt.source,
        batchId,
        receiptId: receipt.receiptId,
        externalId: receipt.externalId ?? null,
        webViewLink: uploaded.webViewLink,
        folderId: uploaded.folderId,
        folderPath: uploaded.folderPath ?? [],
      } as unknown as Prisma.InputJsonValue,
      extractedData: {
        physiotherapistName,
        receiptId: receipt.receiptId,
        batchId,
      } as unknown as Prisma.InputJsonValue,
      uploadedBy: actorUserId ?? null,
      uploadedAt: now,
    });

    await recordFinancialAuditEvent({
      financialClosingId: closing.id,
      financialClosingLineId: line?.id ?? null,
      financialDocumentId: document.id,
      type: 'DOCUMENT_REGISTERED',
      actorUserId: actorUserId ?? null,
      actorName: null,
      message: `Comprovante sincronizado do lote ${batchId}.`,
      details: {
        batchId,
        receiptId: receipt.receiptId,
        physiotherapistId,
        physiotherapistName,
        fileId: uploaded.fileId,
      } as unknown as Prisma.InputJsonValue,
    });

    synced += 1;
    documentIds.push(document.id);
    receiptIds.push(receipt.receiptId);
  }

  const remainingOpenLines = await prisma.financialClosingLine.count({
    where: {
      financialClosingId: closing.id,
      status: {
        in: ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'LOCKED'],
      },
    },
  });

  if (synced > 0 && remainingOpenLines === 0) {
    await updateFinancialClosingStatus(
      referenceMonth,
      'PAYMENT_CONFIRMED',
      actorUserId ?? null,
      null,
      `Comprovantes sincronizados do lote ${batchId}.`
    );
  }

  return {
    batchId,
    referenceMonth,
    synced,
    skipped,
    documentIds,
    receiptIds,
  };
}

export async function sendFinancialBatchReceiptEmail(
  referenceMonth: string,
  batchId: string,
  receiptId: string,
  actorUserId?: number | null
): Promise<FinancialBatchReceiptEmailResult> {
  const manifest = await loadFinancialBatch(batchId);

  if (!manifest) {
    throw new Error('Lote financeiro nao encontrado.');
  }

  const closing = await ensureFinancialClosing(referenceMonth, {
    createdByUserId: actorUserId ?? null,
  });

  const receipt = manifest.receipts.find((item) => item.receiptId === receiptId);
  if (!receipt || !receipt.filePath) {
    throw new Error('Comprovante nao encontrado.');
  }

  const fileBuffer = await fs.readFile(receipt.filePath);
  const physiotherapist = manifest.payments.find(
    (payment) => payment.physiotherapistId === receipt.physiotherapistId
  );
  const line = resolveFinancialClosingLineByPhysiotherapist(
    closing,
    receipt.physiotherapistId,
    receipt.physiotherapistName || physiotherapist?.physiotherapistName || 'Fisioterapeuta'
  );

  const recipientEmail = line?.physiotherapistEmail || physiotherapist?.physiotherapistEmail;
  if (!recipientEmail) {
    throw new Error('E-mail do destinatario nao encontrado.');
  }

  let rpaBuffer: Buffer | undefined;
  let rpaFileName: string | undefined;

  if ((line?.contractType || physiotherapist?.contractType) === 'RPA') {
    const rpaDocument = await prisma.financialDocument.findFirst({
      where: {
        financialClosingId: closing.id,
        physiotherapistId: receipt.physiotherapistId || physiotherapist?.physiotherapistId || null,
        type: 'RPA',
        status: 'AVAILABLE',
      },
      orderBy: [{ uploadedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (rpaDocument?.fileId) {
      const { getFileFromDrive } = await import('./google-drive');
      rpaBuffer = await getFileFromDrive(rpaDocument.fileId);
      rpaFileName = rpaDocument.fileName;
    }
  }

  const result = await sendPaymentReceipt(
    recipientEmail,
    referenceMonth,
    fileBuffer,
    receipt.fileName,
    rpaBuffer,
    rpaFileName
  );

  if (!result.success) {
    throw new Error(result.error || 'Erro ao enviar comprovante por e-mail.');
  }

  await recordFinancialAuditEvent({
    financialClosingId: closing.id,
    financialClosingLineId: line?.id ?? null,
    actorUserId: actorUserId ?? null,
    type: 'AUDIT_NOTE',
    message: `Comprovante do lote ${batchId} enviado por e-mail para ${recipientEmail}.`,
    details: {
      batchId,
      receiptId,
      messageId: result.messageId || null,
    } as unknown as Prisma.InputJsonValue,
  });

  return {
    batchId,
    receiptId,
    success: true,
    messageId: result.messageId,
  };
}

export async function setPaymentBatchStatus(
  paymentBatchId: number,
  status: PaymentBatchStatus,
  actorUserId?: number | null,
  message?: string | null
) {
  const batch = await prisma.paymentBatch.findUnique({
    where: { id: paymentBatchId },
  });

  if (!batch) {
    throw new Error('Lote bancario nao encontrado.');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.paymentBatch.update({
      where: { id: paymentBatchId },
      data: {
        status,
        generatedAt: status === 'GENERATED' ? new Date() : batch.generatedAt,
        sentAt: status === 'SUBMITTED' ? new Date() : batch.sentAt,
        confirmedAt: status === 'CONFIRMED' ? new Date() : batch.confirmedAt,
        returnedAt: status === 'FAILED' ? new Date() : batch.returnedAt,
      },
    });

    await tx.financialAuditEvent.create({
      data: {
        financialClosingId: batch.financialClosingId,
        paymentBatchId: paymentBatchId,
        type: status === 'GENERATED' ? 'BATCH_GENERATED' : 'STATUS_CHANGED',
        actorUserId: actorUserId ?? null,
        message: message ?? `Status do lote alterado para ${status}.`,
        details: {
          previousStatus: batch.status,
          nextStatus: status,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  });
}
