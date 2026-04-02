import type { ContractType, ShiftPeriod } from '@prisma/client';

export const financialClosingStatuses = [
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED_FOR_PAYMENT',
  'BANK_FILE_GENERATED',
  'BANK_SUBMITTED',
  'PAYMENT_CONFIRMED',
  'CLOSED',
  'REOPENED',
  'ARCHIVED',
] as const;

export type FinancialClosingStatus = (typeof financialClosingStatuses)[number];

export const financialClosingLineStatuses = [
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'LOCKED',
  'PAID',
  'CANCELLED',
] as const;

export type FinancialClosingLineStatus = (typeof financialClosingLineStatuses)[number];

export const financialAdjustmentTypes = [
  'BONUS',
  'CREDIT',
  'DEBIT',
  'DISCOUNT',
  'CORRECTION',
  'OTHER',
] as const;

export type FinancialAdjustmentType = (typeof financialAdjustmentTypes)[number];

export const financialDocumentTypes = [
  'RPA',
  'INVOICE',
  'PIX_RECEIPT',
  'BANK_FILE',
  'BANK_RETURN',
  'EMAIL_RECEIPT',
  'OTHER',
] as const;

export type FinancialDocumentType = (typeof financialDocumentTypes)[number];

export const financialDocumentStatuses = [
  'PENDING',
  'AVAILABLE',
  'ARCHIVED',
  'INVALID',
] as const;

export type FinancialDocumentStatus = (typeof financialDocumentStatuses)[number];

export const financialAuditEventTypes = [
  'SNAPSHOT_CREATED',
  'LINE_CREATED',
  'ADJUSTMENT_CREATED',
  'DOCUMENT_REGISTERED',
  'BATCH_CREATED',
  'BATCH_GENERATED',
  'STATUS_CHANGED',
  'PAYMENT_CONFIRMED',
  'REOPENED',
  'AUDIT_NOTE',
] as const;

export type FinancialAuditEventType = (typeof financialAuditEventTypes)[number];

export const paymentBatchStatuses = [
  'DRAFT',
  'READY',
  'GENERATED',
  'SUBMITTED',
  'CONFIRMED',
  'FAILED',
  'CANCELLED',
] as const;

export type PaymentBatchStatus = (typeof paymentBatchStatuses)[number];

export interface FinancialTeamBreakdownSnapshot {
  teamId: number;
  teamName: string;
  periods: Record<ShiftPeriod, number>;
  totalShifts: number;
  totalValue: number;
  shiftValues: number[];
}

export interface FinancialShiftSnapshot {
  shiftId: number;
  date: string;
  period: ShiftPeriod;
  teamId: number;
  teamName: string;
  shiftValue: number;
  additionalValue: number;
}

export interface FinancialClosingLineSnapshot {
  physiotherapistId: number;
  physiotherapistName: string;
  physiotherapistEmail: string;
  contractType: ContractType;
  primaryTeamId: number | null;
  primaryTeamName: string | null;
  totalShifts: number;
  grossCalculatedValue: number;
  adjustmentTotalValue: number;
  additionalValue: number;
  netValue: number;
  teamBreakdowns: FinancialTeamBreakdownSnapshot[];
  shiftDetails: FinancialShiftSnapshot[];
}

export interface FinancialClosingSnapshot {
  referenceMonth: string;
  year: number;
  month: number;
  totalPhysiotherapists: number;
  totalShifts: number;
  totalGrossValue: number;
  totalAdjustmentValue: number;
  totalNetValue: number;
  sourceChecksum: string;
  generatedAt: string;
  lines: FinancialClosingLineSnapshot[];
}

