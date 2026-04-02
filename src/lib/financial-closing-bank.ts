import crypto from 'crypto';
import fs from 'fs/promises';
import { ContractType, FinancialDocumentStatus, FinancialDocumentType } from '@prisma/client';

import { getFileFromDrive } from '@/lib/google-drive';
import { recordFinancialAuditEvent, registerFinancialDocument, updateFinancialClosingLineStatus, updateFinancialClosingStatus } from '@/lib/financial-closing';
import { type FinancialDocumentType as DriveDocumentType, uploadFinancialDocumentToDrive } from '@/lib/financial-documents';
import { sendPaymentReceipt } from '@/lib/gmail-sender';
import {
  type BatchPaymentItem,
  type PixKeyType,
  createAndPersistFinancialBatch,
  prepareFinancialBatchExport,
  getBatchExportFile,
  getBatchReceiptFile,
  listFinancialBatches,
  loadFinancialBatch,
  submitFinancialBatch,
  syncFinancialBatch,
  toClientBatchManifest,
  toClientBatchReceipt,
  toBatchSummary,
} from '@/lib/inter-payments';
import { prisma } from '@/lib/prisma';

function parseDecimal(value: unknown) {
  return Number(value || 0);
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

function mapToDriveDocumentType(documentType: FinancialDocumentType): DriveDocumentType {
  switch (documentType) {
    case 'RPA':
      return 'RPA';
    case 'INVOICE':
      return 'NF';
    case 'PIX_RECEIPT':
      return 'PIX_RECEIPT';
    case 'BANK_FILE':
      return 'BANK_FILE';
    case 'BANK_RETURN':
      return 'BANK_RETURN';
    default:
      return 'OTHER';
  }
}

async function getClosingForBank(referenceMonth: string) {
  const closing = await prisma.financialClosing.findUnique({
    where: { referenceMonth },
    include: {
      lines: {
        include: {
          physiotherapist: {
            select: {
              id: true,
              name: true,
              email: true,
              contractType: true,
              cpf: true,
              cnpjEmpresa: true,
              chavePix: true,
              tipoPix: true,
            },
          },
          documents: true,
        },
        orderBy: [{ physiotherapistName: 'asc' }],
      },
      documents: true,
    },
  });

  if (!closing) {
    throw new Error('Fechamento financeiro não encontrado.');
  }

  return closing;
}

async function buildBatchPaymentsFromClosing(referenceMonth: string): Promise<BatchPaymentItem[]> {
  const closing = await getClosingForBank(referenceMonth);
  const approvedLines = closing.lines.filter((line) => ['APPROVED', 'LOCKED', 'PAID'].includes(line.status));

  if (approvedLines.length === 0) {
    throw new Error('Aprove ao menos uma linha do fechamento antes de gerar o lote bancário.');
  }

  return approvedLines.map((line) => {
    const pixTarget = resolvePixTarget({
      contractType: line.physiotherapist.contractType,
      cpf: line.physiotherapist.cpf,
      cnpjEmpresa: line.physiotherapist.cnpjEmpresa,
      chavePix: line.physiotherapist.chavePix,
      tipoPix: line.physiotherapist.tipoPix,
    });

    const teamBreakdown = Array.isArray(line.teamBreakdownSnapshot)
      ? (line.teamBreakdownSnapshot as Array<{
          teamId: number;
          teamName: string;
          totalShifts: number;
          totalValue: number;
          periods?: Record<'MORNING' | 'INTERMEDIATE' | 'AFTERNOON' | 'NIGHT', number>;
        }>)
      : [];

    const shiftDetails = Array.isArray(line.shiftDetailsSnapshot)
      ? (line.shiftDetailsSnapshot as Array<{
          shiftId: number;
          date: string;
          period: 'MORNING' | 'INTERMEDIATE' | 'AFTERNOON' | 'NIGHT';
          teamId: number;
          teamName: string;
          shiftValue: number;
          additionalValue: number;
        }>)
      : [];

    const rpaDocument = line.documents.find((document) => document.type === 'RPA');
    const invoiceDocument = line.documents.find((document) => document.type === 'INVOICE');
    const grossValue = parseDecimal(line.grossCalculatedValue);
    const additionalValue = parseDecimal(line.additionalValue);

    return {
      physiotherapistId: line.physiotherapistId,
      physiotherapistName: line.physiotherapistName,
      physiotherapistEmail: line.physiotherapistEmail || '',
      contractType: line.contractType,
      cpfCnpj: pixTarget.cpfCnpj,
      pixKeyType: pixTarget.pixKeyType,
      pixKey: pixTarget.pixKey,
      totalShifts: line.totalShifts,
      totalShiftValue: grossValue - additionalValue,
      additionalValue,
      grossValue,
      netValue: parseDecimal(line.netValue),
      teamBreakdown: teamBreakdown.map((team) => ({
        teamId: team.teamId,
        teamName: team.teamName,
        totalShifts: team.totalShifts,
        totalValue: team.totalValue,
        periods: {
          MORNING: team.periods?.MORNING || 0,
          INTERMEDIATE: team.periods?.INTERMEDIATE || 0,
          AFTERNOON: team.periods?.AFTERNOON || 0,
          NIGHT: team.periods?.NIGHT || 0,
        },
      })),
      shiftDetails,
      documentHints: {
        rpaFileName: rpaDocument?.fileName || null,
        nfFileName: invoiceDocument?.fileName || null,
      },
    };
  });
}

async function registerReceiptDocument(params: {
  referenceMonth: string;
  lineId: number;
  physiotherapistId: number;
  physiotherapistName: string;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  uploadedBy: number | null;
  batchId: string;
  receiptId: string;
  externalId?: string;
}) {
  const closing = await prisma.financialClosing.findUnique({
    where: { referenceMonth: params.referenceMonth },
  });

  if (!closing) {
    throw new Error('Fechamento financeiro não encontrado para registrar comprovante.');
  }

  const fileHash = crypto.createHash('sha256').update(params.fileBuffer).digest('hex');
  const existingDocument = await prisma.financialDocument.findFirst({
    where: {
      financialClosingId: closing.id,
      financialClosingLineId: params.lineId,
      type: 'PIX_RECEIPT',
      OR: [
        { fileHash },
        { fileName: params.fileName },
      ],
    },
  });

  if (existingDocument) {
    return existingDocument;
  }

  const uploaded = await uploadFinancialDocumentToDrive({
    buffer: params.fileBuffer,
    fileName: params.fileName,
    mimeType: params.mimeType,
    physiotherapistName: params.physiotherapistName,
    competence: params.referenceMonth,
    documentType: mapToDriveDocumentType('PIX_RECEIPT'),
    source: 'bank_api',
  });

  return registerFinancialDocument({
    financialClosingId: closing.id,
    financialClosingLineId: params.lineId,
    physiotherapistId: params.physiotherapistId,
    type: 'PIX_RECEIPT',
    status: FinancialDocumentStatus.AVAILABLE,
    provider: 'BANCO_INTER',
    fileName: uploaded.fileName,
    fileId: uploaded.fileId,
    fileUrl: uploaded.webViewLink,
    mimeType: params.mimeType,
    fileHash,
    folderPath: uploaded.folderPath.join(' / '),
    referenceMonth: params.referenceMonth,
    metadata: {
      source: 'bank_api',
      batchId: params.batchId,
      receiptId: params.receiptId,
      externalId: params.externalId || null,
      folderId: uploaded.folderId,
      folderPath: uploaded.folderPath,
      rootFolderName: uploaded.rootFolderName,
    },
    uploadedBy: params.uploadedBy,
    uploadedAt: new Date(),
  });
}

async function registerExportFileDocument(params: {
  referenceMonth: string;
  fileBuffer: Buffer;
  fileName: string;
  uploadedBy: number | null;
  batchId: string;
}) {
  const closing = await prisma.financialClosing.findUnique({
    where: { referenceMonth: params.referenceMonth },
  });

  if (!closing) {
    throw new Error('Fechamento financeiro não encontrado para registrar arquivo bancário.');
  }

  const fileHash = crypto.createHash('sha256').update(params.fileBuffer).digest('hex');
  const existingDocument = await prisma.financialDocument.findFirst({
    where: {
      financialClosingId: closing.id,
      type: 'BANK_FILE',
      OR: [
        { fileHash },
        { fileName: params.fileName },
      ],
    },
  });

  if (existingDocument) {
    return existingDocument;
  }

  const uploaded = await uploadFinancialDocumentToDrive({
    buffer: params.fileBuffer,
    fileName: params.fileName,
    mimeType: 'text/plain',
    physiotherapistName: 'Financeiro Furquim',
    competence: params.referenceMonth,
    documentType: mapToDriveDocumentType('BANK_FILE'),
    source: 'system',
  });

  return registerFinancialDocument({
    financialClosingId: closing.id,
    type: 'BANK_FILE',
    status: FinancialDocumentStatus.AVAILABLE,
    provider: 'BANCO_INTER',
    fileName: uploaded.fileName,
    fileId: uploaded.fileId,
    fileUrl: uploaded.webViewLink,
    mimeType: 'text/plain',
    fileHash,
    folderPath: uploaded.folderPath.join(' / '),
    referenceMonth: params.referenceMonth,
    metadata: {
      source: 'system',
      batchId: params.batchId,
      folderId: uploaded.folderId,
      folderPath: uploaded.folderPath,
      rootFolderName: uploaded.rootFolderName,
    },
    uploadedBy: params.uploadedBy,
    uploadedAt: new Date(),
  });
}

export async function listClosingBankBatches(referenceMonth: string) {
  const batches = await listFinancialBatches();
  return batches.filter((batch) => batch.referenceMonth === referenceMonth);
}

export async function createClosingBankBatch(referenceMonth: string, actor?: {
  id?: number | null;
  name?: string | null;
  email?: string | null;
}) {
  const payments = await buildBatchPaymentsFromClosing(referenceMonth);
  const manifest = await createAndPersistFinancialBatch({
    referenceMonth,
    payments,
    source: 'CUSTOM',
    notes: `Lote gerado a partir da compet?ncia ${referenceMonth}.`,
    createdBy: actor
      ? {
          id: actor.id ?? undefined,
          name: actor.name ?? undefined,
          email: actor.email ?? undefined,
        }
      : undefined,
  });
  const preparedManifest = await prepareFinancialBatchExport(manifest.id);

  await updateFinancialClosingStatus(
    referenceMonth,
    'BANK_FILE_GENERATED',
    actor?.id ?? null,
    actor?.name ?? null,
    `Lote banc?rio ${preparedManifest.id} gerado para a compet?ncia ${referenceMonth}.`
  );

  return {
    batch: toClientBatchManifest(preparedManifest),
    summary: toBatchSummary(preparedManifest),
  };
}

export async function submitClosingBankBatch(referenceMonth: string, batchId: string, actor?: {
  id?: number | null;
  name?: string | null;
}) {
  const manifest = await submitFinancialBatch(batchId);

  if (manifest.referenceMonth !== referenceMonth) {
    throw new Error('O lote informado n?o pertence ? compet?ncia selecionada.');
  }

  await updateFinancialClosingStatus(
    referenceMonth,
    'BANK_SUBMITTED',
    actor?.id ?? null,
    actor?.name ?? null,
    manifest.transport === 'CNAB_FALLBACK'
      ? `Lote banc?rio ${batchId} marcado como enviado manualmente ao banco.`
      : `Lote banc?rio ${batchId} submetido ao banco.`
  );

  return {
    batch: toClientBatchManifest(manifest),
    summary: toBatchSummary(manifest),
  };
}

export async function syncClosingBankBatch(referenceMonth: string, batchId: string, actor?: {
  id?: number | null;
  name?: string | null;
}) {
  const manifest = await syncFinancialBatch(batchId);

  if (manifest.referenceMonth !== referenceMonth) {
    throw new Error('O lote informado não pertence à competência selecionada.');
  }

  const closing = await getClosingForBank(referenceMonth);
  const lineByPhysiotherapist = new Map(closing.lines.map((line) => [line.physiotherapistId, line]));
  const syncedReceipts: Array<{ receiptId: string; documentId: number; physiotherapistName: string }> = [];

  for (const receipt of manifest.receipts) {
    const line = lineByPhysiotherapist.get(receipt.physiotherapistId);
    if (!line) {
      continue;
    }

    const fileData = await getBatchReceiptFile(batchId, receipt.receiptId);
    const fileBuffer = await fs.readFile(fileData.filePath);
    const document = await registerReceiptDocument({
      referenceMonth,
      lineId: line.id,
      physiotherapistId: line.physiotherapistId,
      physiotherapistName: line.physiotherapistName,
      fileBuffer,
      fileName: fileData.fileName,
      mimeType: fileData.mimeType,
      uploadedBy: actor?.id ?? null,
      batchId,
      receiptId: receipt.receiptId,
      externalId: receipt.externalId,
    });

    if (line.status !== 'PAID') {
      await updateFinancialClosingLineStatus(
        referenceMonth,
        line.id,
        'PAID',
        actor?.id ?? null,
        'Linha marcada como paga após sincronização de comprovante bancário.'
      );
    }

    syncedReceipts.push({
      receiptId: receipt.receiptId,
      documentId: document.id,
      physiotherapistName: line.physiotherapistName,
    });
  }

  if (syncedReceipts.length > 0) {
    await updateFinancialClosingStatus(
      referenceMonth,
      'PAYMENT_CONFIRMED',
      actor?.id ?? null,
      actor?.name ?? null,
      `Comprovantes sincronizados para o lote ${batchId}.`
    );
  }

  return {
    batch: toClientBatchManifest(manifest),
    summary: toBatchSummary(manifest),
    syncedReceipts,
  };
}

export async function getClosingBankBatch(batchId: string, referenceMonth?: string) {
  const manifest = await loadFinancialBatch(batchId);

  if (!manifest) {
    throw new Error('Lote bancário não encontrado.');
  }

  if (referenceMonth && manifest.referenceMonth !== referenceMonth) {
    throw new Error('O lote informado não pertence à competência selecionada.');
  }

  return {
    batch: toClientBatchManifest(manifest),
    summary: toBatchSummary(manifest),
    receipts: manifest.receipts.map(toClientBatchReceipt),
  };
}

export async function downloadClosingBankReceipt(batchId: string, receiptId: string, referenceMonth?: string) {
  const manifest = await loadFinancialBatch(batchId);

  if (!manifest) {
    throw new Error('Lote bancário não encontrado.');
  }

  if (referenceMonth && manifest.referenceMonth !== referenceMonth) {
    throw new Error('O lote informado não pertence à competência selecionada.');
  }

  return getBatchReceiptFile(batchId, receiptId);
}

export async function downloadClosingBankExport(batchId: string, referenceMonth?: string) {
  const manifest = await loadFinancialBatch(batchId);

  if (!manifest) {
    throw new Error('Lote bancário não encontrado.');
  }

  if (referenceMonth && manifest.referenceMonth !== referenceMonth) {
    throw new Error('O lote informado não pertence à competência selecionada.');
  }

  return getBatchExportFile(batchId);
}

export async function sendClosingReceiptEmails(referenceMonth: string, actor?: {
  id?: number | null;
  name?: string | null;
}, batchId?: string) {
  const closing = await getClosingForBank(referenceMonth);
  const results: Array<{
    lineId: number;
    physiotherapistName: string;
    email: string;
    success: boolean;
    message?: string;
    error?: string;
  }> = [];

  for (const line of closing.lines) {
    if (!line.physiotherapistEmail) {
      results.push({
        lineId: line.id,
        physiotherapistName: line.physiotherapistName,
        email: '',
        success: false,
        error: 'Fisioterapeuta sem e-mail cadastrado.',
      });
      continue;
    }

    const pixReceiptDocument = [...line.documents]
      .filter((document) => {
        if (document.type !== 'PIX_RECEIPT' || !document.fileId) {
          return false;
        }

        if (!batchId) {
          return true;
        }

        const metadata = document.metadata as { batchId?: string } | null;
        return metadata?.batchId === batchId;
      })
      .sort((a, b) => new Date(b.uploadedAt || b.createdAt).getTime() - new Date(a.uploadedAt || a.createdAt).getTime())[0];

    if (!pixReceiptDocument?.fileId) {
      results.push({
        lineId: line.id,
        physiotherapistName: line.physiotherapistName,
        email: line.physiotherapistEmail,
        success: false,
        error: 'Comprovante PIX ainda não sincronizado para esta linha.',
      });
      continue;
    }

    try {
      const pixReceiptBuffer = await getFileFromDrive(pixReceiptDocument.fileId);
      const rpaDocument = [...line.documents]
        .filter((document) => document.type === 'RPA' && !!document.fileId)
        .sort((a, b) => new Date(b.uploadedAt || b.createdAt).getTime() - new Date(a.uploadedAt || a.createdAt).getTime())[0];

      const rpaBuffer = rpaDocument?.fileId ? await getFileFromDrive(rpaDocument.fileId) : undefined;
      const result = await sendPaymentReceipt(
        line.physiotherapistEmail,
        referenceMonth,
        pixReceiptBuffer,
        pixReceiptDocument.fileName,
        rpaBuffer,
        rpaDocument?.fileName
      );

      if (!result.success) {
        results.push({
          lineId: line.id,
          physiotherapistName: line.physiotherapistName,
          email: line.physiotherapistEmail,
          success: false,
          error: result.error || 'Falha ao enviar e-mail.',
        });
        continue;
      }

      await recordFinancialAuditEvent({
        financialClosingId: closing.id,
        financialClosingLineId: line.id,
        actorUserId: actor?.id ?? null,
        actorName: actor?.name ?? null,
        type: 'AUDIT_NOTE',
        message: `Comprovante enviado por e-mail para ${line.physiotherapistEmail}.`,
        details: {
          email: line.physiotherapistEmail,
          batchId: batchId ?? null,
          pixReceiptDocumentId: pixReceiptDocument.id,
          rpaDocumentId: rpaDocument?.id ?? null,
          providerMessageId: result.messageId ?? null,
        },
      });

      results.push({
        lineId: line.id,
        physiotherapistName: line.physiotherapistName,
        email: line.physiotherapistEmail,
        success: true,
        message: 'E-mail enviado com sucesso.',
      });
    } catch (error) {
      results.push({
        lineId: line.id,
        physiotherapistName: line.physiotherapistName,
        email: line.physiotherapistEmail,
        success: false,
        error: error instanceof Error ? error.message : 'Falha ao enviar e-mail.',
      });
    }
  }

  return {
    total: results.length,
    success: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
    results,
  };
}
