import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { ContractType, ShiftPeriod } from '@prisma/client';

import { prisma } from './prisma';
import {
  buildMonthlyShiftPaymentEntries,
  groupMonthlyShiftPaymentEntries,
  type MonthlyPaymentFilters,
  type MonthlyPhysiotherapistPaymentSummary,
} from './payment-calculator';
import { gerarCnabPix, type CompanyData, type Payment as CnabPayment } from './cnab-generator';

export type FinancialBatchTransport = 'INTER_API' | 'CNAB_FALLBACK' | 'UNKNOWN';
export type FinancialBatchStatus = 'DRAFT' | 'READY_FOR_SUBMISSION' | 'SUBMITTED' | 'SYNCED' | 'COMPLETED' | 'FAILED';
export type FinancialReceiptStatus = 'PENDING' | 'AVAILABLE' | 'DOWNLOADED' | 'FAILED';
export type FinancialDocumentKind = 'PIX_RECEIPT' | 'RPA' | 'NF' | 'BANK_FILE' | 'BATCH_MANIFEST';
export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'CELULAR' | 'ALEATORIA';

export interface BatchShiftSnapshot {
  shiftId: number;
  date: string;
  period: ShiftPeriod;
  teamId: number;
  teamName: string;
  shiftValue: number;
  additionalValue: number;
}

export interface BatchTeamBreakdown {
  teamId: number;
  teamName: string;
  totalShifts: number;
  totalValue: number;
  periods: Record<ShiftPeriod, number>;
}

export interface BatchPaymentItem {
  physiotherapistId: number;
  physiotherapistName: string;
  physiotherapistEmail: string;
  contractType: ContractType;
  cpfCnpj: string;
  pixKeyType: PixKeyType;
  pixKey: string;
  totalShifts: number;
  totalShiftValue: number;
  additionalValue: number;
  grossValue: number;
  netValue: number;
  teamBreakdown: BatchTeamBreakdown[];
  shiftDetails: BatchShiftSnapshot[];
  documentHints: {
    rpaFileName: string | null;
    nfFileName: string | null;
  };
}

export interface BatchReceiptArtifact {
  receiptId: string;
  physiotherapistId: number;
  physiotherapistName: string;
  fileName: string;
  mimeType: string;
  kind: FinancialDocumentKind;
  status: FinancialReceiptStatus;
  source: 'INTER_API' | 'CNAB_FALLBACK';
  filePath?: string;
  webViewLink?: string;
  downloadedAt?: string;
  externalId?: string;
}

export interface FinancialBatchManifest {
  id: string;
  referenceMonth: string;
  status: FinancialBatchStatus;
  transport: FinancialBatchTransport;
  source: 'MONTHLY_CALCULATION' | 'CUSTOM';
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id?: number;
    name?: string;
    email?: string;
  };
  submittedAt?: string;
  syncedAt?: string;
  externalBatchId?: string;
  externalStatus?: string;
  externalReference?: string;
  cnab?: {
    fileName: string;
    filePath: string;
    sequence: number;
    generatedAt: string;
  };
  company: CompanyData;
  totals: {
    payments: number;
    grossValue: number;
    netValue: number;
  };
  payments: BatchPaymentItem[];
  receipts: BatchReceiptArtifact[];
  notes?: string;
}

export interface FinancialBatchSummary {
  id: string;
  referenceMonth: string;
  status: FinancialBatchStatus;
  transport: FinancialBatchTransport;
  createdAt: string;
  updatedAt: string;
  payments: number;
  grossValue: number;
  netValue: number;
  receipts: number;
  externalStatus?: string;
}

export interface FinancialBatchClientReceipt {
  receiptId: string;
  physiotherapistId: number;
  physiotherapistName: string;
  fileName: string;
  mimeType: string;
  kind: FinancialDocumentKind;
  status: FinancialReceiptStatus;
  source: 'INTER_API' | 'CNAB_FALLBACK';
  webViewLink?: string;
  downloadedAt?: string;
  externalId?: string;
}

export interface FinancialBatchClientManifest
  extends Omit<FinancialBatchManifest, 'receipts' | 'cnab'> {
  receipts: FinancialBatchClientReceipt[];
  cnab?: {
    fileName: string;
    sequence: number;
    generatedAt: string;
  };
}

export interface CreateFinancialBatchInput {
  referenceMonth: string;
  filters?: MonthlyPaymentFilters;
  includeZeroValues?: boolean;
  notes?: string;
  payments?: BatchPaymentItem[];
  source?: 'MONTHLY_CALCULATION' | 'CUSTOM';
  createdBy?: {
    id?: number;
    name?: string;
    email?: string;
  };
}

export interface InterApiConfig {
  baseUrl: string;
  token: string;
  createBatchPath: string;
  statusPathTemplate: string;
  receiptsPathTemplate: string;
  timeoutMs: number;
}

const STORAGE_ROOT = path.join(process.cwd(), 'data', 'financial-batches');

function normalizeReferenceMonth(referenceMonth: string): string {
  if (!/^\d{4}-\d{2}$/.test(referenceMonth)) {
    throw new Error('Formato de mes invalido. Use YYYY-MM.');
  }

  return referenceMonth;
}

function monthDigits(referenceMonth: string): string {
  return normalizeReferenceMonth(referenceMonth).replace('-', '');
}

export function buildFinancialBatchId(referenceMonth: string): string {
  const monthPart = monthDigits(referenceMonth);
  const randomPart = crypto.randomBytes(3).toString('hex');

  return `FB-${monthPart}-${randomPart}`;
}

function batchDirectoryFromId(batchId: string): string {
  const match = batchId.match(/^FB-(\d{4})(\d{2})-/);

  if (!match) {
    throw new Error('ID de lote invalido.');
  }

  const [, year, month] = match;
  return path.join(STORAGE_ROOT, `${year}-${month}`, batchId);
}

function manifestPath(batchId: string): string {
  return path.join(batchDirectoryFromId(batchId), 'manifest.json');
}

function receiptsDirectory(batchId: string): string {
  return path.join(batchDirectoryFromId(batchId), 'receipts');
}

function toIsoDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value;
  }

  return value.toISOString();
}

function toIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function resolvePixKeyType(type?: string | null): PixKeyType {
  switch ((type || '').toUpperCase()) {
    case 'CPF':
      return 'CPF';
    case 'CNPJ':
      return 'CNPJ';
    case 'CELULAR':
    case 'TELEFONE':
      return 'CELULAR';
    case 'ALEATORIA':
    case 'RANDOM':
      return 'ALEATORIA';
    case 'EMAIL':
    default:
      return 'EMAIL';
  }
}

function resolvePixTarget(physio: {
  contractType: ContractType;
  cpf: string;
  cnpjEmpresa: string | null;
  chavePix: string | null;
  tipoPix: string | null;
}): { pixKeyType: PixKeyType; pixKey: string; cpfCnpj: string } {
  if (physio.chavePix) {
    return {
      pixKeyType: resolvePixKeyType(physio.tipoPix),
      pixKey: physio.chavePix,
      cpfCnpj:
        physio.contractType === 'PJ' && physio.cnpjEmpresa
          ? physio.cnpjEmpresa.replace(/\D/g, '')
          : physio.cpf.replace(/\D/g, ''),
    };
  }

  if (physio.contractType === 'PJ' && physio.cnpjEmpresa) {
    return {
      pixKeyType: 'CNPJ',
      pixKey: physio.cnpjEmpresa.replace(/\D/g, ''),
      cpfCnpj: physio.cnpjEmpresa.replace(/\D/g, ''),
    };
  }

  return {
    pixKeyType: 'CPF',
    pixKey: physio.cpf.replace(/\D/g, ''),
    cpfCnpj: physio.cpf.replace(/\D/g, ''),
  };
}

function resolveCompanyData(): CompanyData {
  return {
    cnpj: process.env.FINANCIAL_BATCH_COMPANY_CNPJ || '53914002000152',
    nome: process.env.FINANCIAL_BATCH_COMPANY_NAME || 'FURQUIM FISIOTERAPIA LTDA',
    conta: process.env.FINANCIAL_BATCH_COMPANY_ACCOUNT || '34242533',
    conta_dv: process.env.FINANCIAL_BATCH_COMPANY_ACCOUNT_DV || '1',
    logradouro: process.env.FINANCIAL_BATCH_COMPANY_STREET || 'RUA DO SOL',
    numero: process.env.FINANCIAL_BATCH_COMPANY_NUMBER || '368',
    complemento: process.env.FINANCIAL_BATCH_COMPANY_COMPLEMENT || '',
    cidade: process.env.FINANCIAL_BATCH_COMPANY_CITY || 'CURITIBA',
    cep: process.env.FINANCIAL_BATCH_COMPANY_CEP || '81910350',
    estado: process.env.FINANCIAL_BATCH_COMPANY_STATE || 'PR',
  };
}

function resolveInterApiConfig(): InterApiConfig | null {
  const baseUrl = process.env.INTER_API_BASE_URL || process.env.BANCO_INTER_API_BASE_URL;
  const token = process.env.INTER_API_TOKEN || process.env.BANCO_INTER_API_TOKEN;

  if (!baseUrl || !token) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    token,
    createBatchPath: process.env.INTER_API_CREATE_BATCH_PATH || '/payments/pix/batches',
    statusPathTemplate: process.env.INTER_API_BATCH_STATUS_PATH || '/payments/pix/batches/:batchId',
    receiptsPathTemplate: process.env.INTER_API_BATCH_RECEIPTS_PATH || '/payments/pix/batches/:batchId/receipts',
    timeoutMs: Number(process.env.INTER_API_TIMEOUT_MS || '30000'),
  };
}

async function ensureStorageDirectories(referenceMonth: string, batchId: string) {
  await fs.mkdir(path.join(STORAGE_ROOT, referenceMonth), { recursive: true });
  await fs.mkdir(batchDirectoryFromId(batchId), { recursive: true });
  await fs.mkdir(receiptsDirectory(batchId), { recursive: true });
}

async function writeManifest(manifest: FinancialBatchManifest): Promise<void> {
  await ensureStorageDirectories(manifest.referenceMonth, manifest.id);
  await fs.writeFile(manifestPath(manifest.id), JSON.stringify(manifest, null, 2), 'utf-8');
}

export async function loadFinancialBatch(batchId: string): Promise<FinancialBatchManifest | null> {
  try {
    const raw = await fs.readFile(manifestPath(batchId), 'utf-8');
    return JSON.parse(raw) as FinancialBatchManifest;
  } catch {
    return null;
  }
}

export async function listFinancialBatches(): Promise<FinancialBatchSummary[]> {
  try {
    const rootEntries = await fs.readdir(STORAGE_ROOT, { withFileTypes: true });
    const monthDirs = rootEntries.filter((entry) => entry.isDirectory());
    const batches: FinancialBatchSummary[] = [];

    for (const monthDir of monthDirs) {
      const monthPath = path.join(STORAGE_ROOT, monthDir.name);
      const batchDirs = await fs.readdir(monthPath, { withFileTypes: true });

      for (const batchDir of batchDirs) {
        if (!batchDir.isDirectory()) {
          continue;
        }

        const manifest = await loadFinancialBatch(batchDir.name);
        if (!manifest) {
          continue;
        }

        batches.push(toBatchSummary(manifest));
      }
    }

    return batches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function toBatchSummary(manifest: FinancialBatchManifest): FinancialBatchSummary {
  return {
    id: manifest.id,
    referenceMonth: manifest.referenceMonth,
    status: manifest.status,
    transport: manifest.transport,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
    payments: manifest.totals.payments,
    grossValue: manifest.totals.grossValue,
    netValue: manifest.totals.netValue,
    receipts: manifest.receipts.length,
    externalStatus: manifest.externalStatus,
  };
}

export function toClientBatchReceipt(receipt: BatchReceiptArtifact): FinancialBatchClientReceipt {
  const { filePath: _filePath, ...rest } = receipt;
  return rest;
}

export function toClientBatchManifest(manifest: FinancialBatchManifest): FinancialBatchClientManifest {
  return {
    ...manifest,
    receipts: manifest.receipts.map(toClientBatchReceipt),
    cnab: manifest.cnab
      ? {
          fileName: manifest.cnab.fileName,
          sequence: manifest.cnab.sequence,
          generatedAt: manifest.cnab.generatedAt,
        }
      : undefined,
  };
}

function mapSummaryToItem(
  summary: MonthlyPhysiotherapistPaymentSummary,
  physio: {
    id: number;
    name: string;
    email: string | null;
    contractType: ContractType;
    cpf: string;
    cnpjEmpresa: string | null;
    chavePix: string | null;
    tipoPix: string | null;
    additionalValue: unknown;
  }
): BatchPaymentItem {
  const pixTarget = resolvePixTarget({
    contractType: physio.contractType,
    cpf: physio.cpf,
    cnpjEmpresa: physio.cnpjEmpresa,
    chavePix: physio.chavePix,
    tipoPix: physio.tipoPix,
  });

  const teamBreakdown = [...summary.teamBreakdown.values()].map((team) => ({
    teamId: team.teamId,
    teamName: team.teamName,
    totalShifts: team.totalShifts,
    totalValue: Number(team.totalValue) || 0,
    periods: {
      MORNING: team.periods.MORNING,
      INTERMEDIATE: team.periods.INTERMEDIATE,
      AFTERNOON: team.periods.AFTERNOON,
      NIGHT: team.periods.NIGHT,
    },
  }));

  return {
    physiotherapistId: physio.id,
    physiotherapistName: physio.name,
    physiotherapistEmail: physio.email || '',
    contractType: physio.contractType,
    cpfCnpj: pixTarget.cpfCnpj,
    pixKeyType: pixTarget.pixKeyType,
    pixKey: pixTarget.pixKey,
    totalShifts: summary.totalShifts,
    totalShiftValue: Number(summary.totalShiftValue) || 0,
    additionalValue: Number(physio.additionalValue) || Number(summary.additionalValue) || 0,
    grossValue: Number(summary.grossValue) || 0,
    netValue: Number(summary.grossValue) || 0,
    teamBreakdown,
    shiftDetails: summary.shiftDetails.map((shift) => ({
      shiftId: shift.shiftId,
      date: toIsoDateOnly(shift.date),
      period: shift.period,
      teamId: shift.teamId,
      teamName: shift.teamName,
      shiftValue: shift.shiftValue,
      additionalValue: shift.additionalValue,
    })),
    documentHints: {
      rpaFileName: null,
      nfFileName: null,
    },
  };
}

async function buildBatchPaymentsFromMonth(
  referenceMonth: string,
  filters: MonthlyPaymentFilters = {},
  includeZeroValues = false
): Promise<BatchPaymentItem[]> {
  const normalizedMonth = normalizeReferenceMonth(referenceMonth);
  const entries = await buildMonthlyShiftPaymentEntries(normalizedMonth, filters);
  const summaries = groupMonthlyShiftPaymentEntries(entries);
  const summaryMap = new Map(
    summaries.map((summary) => [summary.physiotherapistId, summary] as const)
  );

  const physiotherapists = await prisma.physiotherapist.findMany({
    where: {
      status: 'ACTIVE',
      ...(filters.physioId ? { id: filters.physioId } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      contractType: true,
      cpf: true,
      cnpjEmpresa: true,
      chavePix: true,
      tipoPix: true,
      additionalValue: true,
    },
    orderBy: { name: 'asc' },
  });

  const items: BatchPaymentItem[] = [];

  for (const physio of physiotherapists) {
    const summary = summaryMap.get(physio.id);
    const additionalValue = Number(physio.additionalValue) || 0;

    if (!summary && !includeZeroValues && additionalValue <= 0) {
      continue;
    }

    if (summary) {
      const item = mapSummaryToItem(summary, physio);
      if (includeZeroValues || item.grossValue > 0 || item.netValue > 0) {
        items.push(item);
      }
      continue;
    }

    const pixTarget = resolvePixTarget({
      contractType: physio.contractType,
      cpf: physio.cpf,
      cnpjEmpresa: physio.cnpjEmpresa,
      chavePix: physio.chavePix,
      tipoPix: physio.tipoPix,
    });

    items.push({
      physiotherapistId: physio.id,
      physiotherapistName: physio.name,
      physiotherapistEmail: physio.email || '',
      contractType: physio.contractType,
      cpfCnpj: pixTarget.cpfCnpj,
      pixKeyType: pixTarget.pixKeyType,
      pixKey: pixTarget.pixKey,
      totalShifts: 0,
      totalShiftValue: 0,
      additionalValue,
      grossValue: additionalValue,
      netValue: additionalValue,
      teamBreakdown: [],
      shiftDetails: [],
      documentHints: {
        rpaFileName: null,
        nfFileName: null,
      },
    });
  }

  return items;
}

function buildTotals(items: BatchPaymentItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.payments += 1;
      acc.grossValue += Number(item.grossValue) || 0;
      acc.netValue += Number(item.netValue) || 0;
      return acc;
    },
    {
      payments: 0,
      grossValue: 0,
      netValue: 0,
    }
  );
}

function nextSequenceNumber(referenceMonth: string): number {
  const seed = Number(monthDigits(referenceMonth));
  return (seed % 9_000_000) + 1;
}

async function persistReceiptArtifact(
  batchId: string,
  receipt: {
    physiotherapistId: number;
    physiotherapistName: string;
    fileName: string;
    mimeType: string;
    kind: FinancialDocumentKind;
    source: 'INTER_API' | 'CNAB_FALLBACK';
    fileBuffer: Buffer;
    externalId?: string;
    webViewLink?: string;
  }
): Promise<BatchReceiptArtifact> {
  const receiptId = crypto.randomUUID();
  const safeFileName = receipt.fileName.replace(/[^\w.\-() ]+/g, '_');
  const storedFileName = `${receiptId}-${safeFileName}`;
  const filePath = path.join(receiptsDirectory(batchId), storedFileName);

  await fs.writeFile(filePath, receipt.fileBuffer);

  return {
    receiptId,
    physiotherapistId: receipt.physiotherapistId,
    physiotherapistName: receipt.physiotherapistName,
    fileName: storedFileName,
    mimeType: receipt.mimeType,
    kind: receipt.kind,
    status: 'DOWNLOADED',
    source: receipt.source,
    filePath,
    webViewLink: receipt.webViewLink,
    downloadedAt: new Date().toISOString(),
    externalId: receipt.externalId,
  };
}

function interpolatePath(template: string, batchId: string, externalBatchId?: string, receiptId?: string): string {
  return template
    .replaceAll(':batchId', encodeURIComponent(externalBatchId || batchId))
    .replaceAll(':receiptId', encodeURIComponent(receiptId || ''));
}

function resolveRequestUrl(baseUrl: string, pathValue: string): string {
  return `${baseUrl}${pathValue.startsWith('/') ? '' : '/'}${pathValue}`;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function createFinancialBatchDraft(input: CreateFinancialBatchInput): Promise<FinancialBatchManifest> {
  const referenceMonth = normalizeReferenceMonth(input.referenceMonth);
  const batchId = buildFinancialBatchId(referenceMonth);
  const payments = input.payments
    ? input.payments
    : await buildBatchPaymentsFromMonth(referenceMonth, input.filters, input.includeZeroValues ?? false);
  const totals = buildTotals(payments);

  const manifest: FinancialBatchManifest = {
    id: batchId,
    referenceMonth,
    status: 'DRAFT',
    transport: 'UNKNOWN',
    source: input.source ?? (input.payments ? 'CUSTOM' : 'MONTHLY_CALCULATION'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: input.createdBy,
    company: resolveCompanyData(),
    totals,
    payments,
    receipts: [],
    notes: input.notes,
  };

  await writeManifest(manifest);
  return manifest;
}

async function buildCnabFallbackForBatch(manifest: FinancialBatchManifest): Promise<FinancialBatchManifest> {
  const cnabPayments: CnabPayment[] = manifest.payments
    .filter((payment) => Number(payment.netValue) > 0)
    .map((payment) => ({
      nome: payment.physiotherapistName,
      cpf_cnpj: payment.cpfCnpj,
      tipo_chave_pix: payment.pixKeyType,
      chave_pix: payment.pixKey,
      valor: Number(payment.netValue),
    }));

  if (cnabPayments.length === 0) {
    throw new Error('Nenhum pagamento valido encontrado para gerar CNAB.');
  }

  const sequence = nextSequenceNumber(manifest.referenceMonth);
  const { nomeArquivo, conteudo } = gerarCnabPix(manifest.company, cnabPayments, sequence);
  const cnabPath = path.join(batchDirectoryFromId(manifest.id), nomeArquivo);

  await fs.writeFile(cnabPath, conteudo, 'utf-8');

  const updated: FinancialBatchManifest = {
    ...manifest,
    transport: 'CNAB_FALLBACK',
    status: 'READY_FOR_SUBMISSION',
    updatedAt: new Date().toISOString(),
    cnab: {
      fileName: nomeArquivo,
      filePath: cnabPath,
      sequence,
      generatedAt: new Date().toISOString(),
    },
  };

  await writeManifest(updated);
  return updated;
}

export async function prepareFinancialBatchExport(batchId: string): Promise<FinancialBatchManifest> {
  const manifest = await loadFinancialBatch(batchId);

  if (!manifest) {
    throw new Error('Lote financeiro nao encontrado.');
  }

  if (manifest.cnab?.filePath) {
    return manifest;
  }

  return buildCnabFallbackForBatch(manifest);
}

async function submitBatchToInterApi(manifest: FinancialBatchManifest, config: InterApiConfig): Promise<FinancialBatchManifest> {
  const payload = {
    batchId: manifest.id,
    referenceMonth: manifest.referenceMonth,
    company: manifest.company,
    totals: manifest.totals,
    payments: manifest.payments,
    source: 'plantaofisio',
  };

  const response = await requestWithTimeout(
    resolveRequestUrl(config.baseUrl, config.createBatchPath),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    },
    config.timeoutMs
  );

  if (!response.ok) {
    const errorPayload = await parseJsonResponse(response);
    throw new Error(
      typeof errorPayload === 'string'
        ? errorPayload
        : 'Falha ao submeter lote ao Banco Inter.'
    );
  }

  const responsePayload = (await parseJsonResponse(response)) as
    | {
        batchId?: string;
        id?: string;
        status?: string;
        receipts?: unknown[];
        externalReference?: string;
        [key: string]: unknown;
      }
    | null;

  const receiptArtifacts = await fetchReceiptsFromPayload(
    manifest,
    responsePayload?.receipts || [],
    config,
    'INTER_API'
  );

  const updated: FinancialBatchManifest = {
    ...manifest,
    transport: 'INTER_API',
    status: 'SUBMITTED',
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    externalBatchId: responsePayload?.batchId || responsePayload?.id || manifest.externalBatchId,
    externalStatus: responsePayload?.status || 'SUBMITTED',
    externalReference: responsePayload?.externalReference || manifest.externalReference,
    receipts: mergeReceipts(manifest.receipts, receiptArtifacts),
  };

  await writeManifest(updated);
  return updated;
}

async function syncBatchFromInterApi(manifest: FinancialBatchManifest, config: InterApiConfig): Promise<FinancialBatchManifest> {
  const externalBatchId = manifest.externalBatchId || manifest.id;
  const statusUrl = resolveRequestUrl(
    config.baseUrl,
    interpolatePath(config.statusPathTemplate, manifest.id, externalBatchId)
  );

  const response = await requestWithTimeout(
    statusUrl,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/json',
      },
    },
    config.timeoutMs
  );

  if (!response.ok) {
    const payload = await parseJsonResponse(response);
    throw new Error(
      typeof payload === 'string'
        ? payload
        : 'Falha ao consultar status do lote no Banco Inter.'
    );
  }

  const payload = (await parseJsonResponse(response)) as
    | {
        status?: string;
        receipts?: unknown[];
        externalReference?: string;
        [key: string]: unknown;
      }
    | null;

  let receipts = [...manifest.receipts];

  const fetchedReceipts = await fetchReceiptsFromInterApi(manifest, config, payload?.receipts);
  if (fetchedReceipts.length > 0) {
    receipts = mergeReceipts(receipts, fetchedReceipts);
  }

  const updated: FinancialBatchManifest = {
    ...manifest,
    status: (payload?.status as FinancialBatchStatus) || manifest.status,
    externalStatus: payload?.status || manifest.externalStatus,
    externalReference: payload?.externalReference || manifest.externalReference,
    syncedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receipts,
  };

  await writeManifest(updated);
  return updated;
}

async function fetchReceiptsFromInterApi(
  manifest: FinancialBatchManifest,
  config: InterApiConfig,
  receiptsPayload?: unknown[]
): Promise<BatchReceiptArtifact[]> {
  if (!Array.isArray(receiptsPayload) || receiptsPayload.length === 0) {
    const receiptsUrl = resolveRequestUrl(
      config.baseUrl,
      interpolatePath(config.receiptsPathTemplate, manifest.id, manifest.externalBatchId)
    );

    const response = await requestWithTimeout(
      receiptsUrl,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/json, application/pdf, application/octet-stream',
        },
      },
      config.timeoutMs
    );

    if (!response.ok) {
      return [];
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const payload = (await parseJsonResponse(response)) as unknown;
      if (Array.isArray(payload)) {
        return fetchReceiptsFromPayload(manifest, payload, config, 'INTER_API');
      }
      if (payload && typeof payload === 'object') {
        const maybeReceipts = (payload as { receipts?: unknown[] }).receipts;
        if (Array.isArray(maybeReceipts)) {
          return fetchReceiptsFromPayload(manifest, maybeReceipts, config, 'INTER_API');
        }
      }
      return [];
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return [
      await persistReceiptArtifact(manifest.id, {
        physiotherapistId: manifest.payments[0]?.physiotherapistId || 0,
        physiotherapistName: manifest.payments[0]?.physiotherapistName || manifest.referenceMonth,
        fileName: `comprovante-${manifest.referenceMonth}.pdf`,
        mimeType: contentType || 'application/pdf',
        kind: 'PIX_RECEIPT',
        source: 'INTER_API',
        fileBuffer: buffer,
      }),
    ];
  }

  return fetchReceiptsFromPayload(manifest, receiptsPayload, config, 'INTER_API');
}

async function fetchReceiptsFromPayload(
  manifest: FinancialBatchManifest,
  receiptsPayload: unknown[],
  config: InterApiConfig,
  source: 'INTER_API' | 'CNAB_FALLBACK'
): Promise<BatchReceiptArtifact[]> {
  const artifacts: BatchReceiptArtifact[] = [];

  for (const rawReceipt of receiptsPayload) {
    if (!rawReceipt || typeof rawReceipt !== 'object') {
      continue;
    }

    const receipt = rawReceipt as {
      id?: string;
      receiptId?: string;
      paymentId?: string | number;
      physiotherapistId?: number;
      physiotherapistName?: string;
      fileName?: string;
      fileNameOriginal?: string;
      mimeType?: string;
      contentBase64?: string;
      downloadUrl?: string;
      webViewLink?: string;
      kind?: FinancialDocumentKind;
      status?: FinancialReceiptStatus;
    };

    const physiotherapistId = Number(receipt.physiotherapistId || receipt.paymentId || 0);
    const physiotherapistName =
      receipt.physiotherapistName || manifest.payments.find((item) => item.physiotherapistId === physiotherapistId)?.physiotherapistName || 'Fisioterapeuta';
    const receiptId = receipt.id || receipt.receiptId || crypto.randomUUID();
    const fileName = receipt.fileName || receipt.fileNameOriginal || `comprovante-${receiptId}.pdf`;
    const mimeType = receipt.mimeType || 'application/pdf';
    let fileBuffer: Buffer | null = null;

    if (receipt.contentBase64) {
      fileBuffer = Buffer.from(receipt.contentBase64, 'base64');
    } else if (receipt.downloadUrl) {
      const downloadUrl = receipt.downloadUrl.startsWith('http')
        ? receipt.downloadUrl
        : resolveRequestUrl(config.baseUrl, receipt.downloadUrl);

      const downloadResponse = await requestWithTimeout(
        downloadUrl,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: mimeType,
          },
        },
        config.timeoutMs
      );

      if (downloadResponse.ok) {
        fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());
      }
    }

    if (!fileBuffer) {
      continue;
    }

    const artifact = await persistReceiptArtifact(manifest.id, {
      physiotherapistId,
      physiotherapistName,
      fileName,
      mimeType,
      kind: receipt.kind || 'PIX_RECEIPT',
      source,
      fileBuffer,
      externalId: receiptId,
      webViewLink: receipt.webViewLink,
    });

    artifacts.push({
      ...artifact,
      status: receipt.status || 'DOWNLOADED',
    });
  }

  return artifacts;
}

function mergeReceipts(existing: BatchReceiptArtifact[], incoming: BatchReceiptArtifact[]): BatchReceiptArtifact[] {
  const map = new Map(existing.map((receipt) => [receipt.receiptId, receipt] as const));

  for (const receipt of incoming) {
    map.set(receipt.receiptId, receipt);
  }

  return [...map.values()];
}

export async function submitFinancialBatch(batchId: string): Promise<FinancialBatchManifest> {
  const manifest = await loadFinancialBatch(batchId);

  if (!manifest) {
  throw new Error('Lote financeiro nao encontrado.');
  }

  if (manifest.transport === 'CNAB_FALLBACK' && manifest.cnab?.filePath) {
    const updated: FinancialBatchManifest = {
      ...manifest,
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      externalStatus: 'SUBMITTED_MANUALLY',
    };

    await writeManifest(updated);
    return updated;
  }

  const interConfig = resolveInterApiConfig();

  if (interConfig) {
    try {
      return await submitBatchToInterApi(manifest, interConfig);
    } catch (error) {
      console.warn('Falha ao submeter ao Banco Inter, usando fallback CNAB.', error);
    }
  }

  return buildCnabFallbackForBatch(manifest);
}

export async function syncFinancialBatch(batchId: string): Promise<FinancialBatchManifest> {
  const manifest = await loadFinancialBatch(batchId);

  if (!manifest) {
    throw new Error('Lote financeiro nao encontrado.');
  }

  const interConfig = resolveInterApiConfig();

  if (!interConfig || !manifest.externalBatchId) {
    return manifest;
  }

  return syncBatchFromInterApi(manifest, interConfig);
}

export async function createAndPersistFinancialBatch(input: CreateFinancialBatchInput): Promise<FinancialBatchManifest> {
  return createFinancialBatchDraft(input);
}

export async function getBatchExportFile(batchId: string): Promise<{
  filePath: string;
  fileName: string;
  mimeType: string;
}> {
  const manifest = await loadFinancialBatch(batchId);

  if (!manifest) {
    throw new Error('Lote financeiro nao encontrado.');
  }

  if (manifest.cnab?.filePath) {
    return {
      filePath: manifest.cnab.filePath,
      fileName: manifest.cnab.fileName,
      mimeType: 'text/plain; charset=utf-8',
    };
  }

  throw new Error('Este lote ainda nao possui arquivo de exportacao disponivel.');
}

export async function getBatchReceiptFile(batchId: string, receiptId: string): Promise<{
  filePath: string;
  fileName: string;
  mimeType: string;
}> {
  const manifest = await loadFinancialBatch(batchId);

  if (!manifest) {
    throw new Error('Lote financeiro nao encontrado.');
  }

  const receipt = manifest.receipts.find((item) => item.receiptId === receiptId);

  if (!receipt || !receipt.filePath) {
    throw new Error('Comprovante nao encontrado.');
  }

  return {
    filePath: receipt.filePath,
    fileName: receipt.fileName,
    mimeType: receipt.mimeType,
  };
}
