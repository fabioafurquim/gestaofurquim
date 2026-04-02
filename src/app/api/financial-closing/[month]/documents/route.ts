import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { FinancialDocumentStatus, FinancialDocumentType } from '@prisma/client';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import {
  type FinancialDocumentType as DriveDocumentType,
  uploadFinancialDocumentToDrive,
} from '@/lib/financial-documents';
import {
  ensureFinancialClosing,
  getFinancialClosingByMonth,
  registerFinancialDocument,
  syncFinancialRpaDocument,
} from '@/lib/financial-closing';
import { prisma } from '@/lib/prisma';
import { parseRPADocument } from '@/lib/rpa-parser';

interface RouteParams {
  params: Promise<{ month: string }>;
}

function normalizeUserId(userId: number | string | undefined | null) {
  if (typeof userId === 'string') {
    return Number.parseInt(userId, 10);
  }

  return userId ?? null;
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

function bufferFromBase64(contentBase64: string) {
  const normalized = contentBase64.includes('base64,')
    ? contentBase64.split('base64,').pop() || ''
    : contentBase64;

  return Buffer.from(normalized, 'base64');
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month } = await params;
  const closing = await getFinancialClosingByMonth(month);

  if (!closing) {
    return NextResponse.json({ error: 'Fechamento nao encontrado.' }, { status: 404 });
  }

  const documents = await prisma.financialDocument.findMany({
    where: { financialClosingId: closing.id },
    orderBy: [{ uploadedAt: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ documents });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireAdminOrManager();
  if (error) {
    return error;
  }

  const { month } = await params;

  try {
    const contentType = request.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await request.json() : await request.formData();
    const file = isJson ? null : (payload.get('file') as File | null);

    const lineIdValue = isJson ? payload.lineId : payload.get('lineId');
    const lineId = lineIdValue !== undefined && lineIdValue !== null && String(lineIdValue) !== ''
      ? Number(lineIdValue)
      : null;

    const documentTypeValue = isJson ? payload.documentType : payload.get('documentType');
    if (!documentTypeValue || !Object.values(FinancialDocumentType).includes(String(documentTypeValue) as FinancialDocumentType)) {
      return NextResponse.json({ error: 'Tipo de documento invalido.' }, { status: 400 });
    }

    const documentType = String(documentTypeValue) as FinancialDocumentType;
    const closing = await ensureFinancialClosing(month, {
      createdByUserId: normalizeUserId(user?.id),
    });

    let line = null;
    if (lineId) {
      line = await prisma.financialClosingLine.findFirst({
        where: {
          id: lineId,
          financialClosingId: closing.id,
        },
      });

      if (!line) {
        return NextResponse.json({ error: 'Linha do fechamento nao encontrada.' }, { status: 404 });
      }
    }

    const physiotherapistIdValue = isJson ? payload.physiotherapistId : payload.get('physiotherapistId');
    const physiotherapistId = line?.physiotherapistId
      ?? (physiotherapistIdValue ? Number(physiotherapistIdValue) : null);

    const physiotherapistName = line?.physiotherapistName
      ?? (isJson ? payload.physiotherapistName : payload.get('physiotherapistName'));

    if (!physiotherapistName || typeof physiotherapistName !== 'string') {
      return NextResponse.json(
        { error: 'physiotherapistName e obrigatorio quando a linha do fechamento nao for informada.' },
        { status: 400 }
      );
    }

    const fileBuffer = isJson
      ? (typeof payload.contentBase64 === 'string' ? bufferFromBase64(payload.contentBase64) : null)
      : (file ? Buffer.from(await file.arrayBuffer()) : null);

    if (!fileBuffer || fileBuffer.byteLength === 0) {
      return NextResponse.json({ error: 'Arquivo obrigatorio.' }, { status: 400 });
    }

    const fileName = isJson
      ? (typeof payload.fileName === 'string' && payload.fileName.trim()) || `${month}_${documentType}.pdf`
      : file?.name || `${month}_${documentType}.pdf`;

    const mimeType = isJson
      ? (typeof payload.mimeType === 'string' && payload.mimeType.trim()) || 'application/octet-stream'
      : file?.type || 'application/octet-stream';
    const isPdfDocument = mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');

    const warnings: string[] = [];

    let uploaded: Awaited<ReturnType<typeof uploadFinancialDocumentToDrive>> | null = null;
    try {
      uploaded = await uploadFinancialDocumentToDrive({
        buffer: fileBuffer,
        fileName,
        mimeType,
        physiotherapistName,
        competence: month,
        documentType: mapToDriveDocumentType(documentType),
        source: isJson && payload.source === 'bank_api' ? 'bank_api' : 'manual',
      });
    } catch (driveError) {
      warnings.push(
        `Nao foi possivel salvar o documento no Google Drive agora: ${driveError instanceof Error ? driveError.message : 'falha desconhecida'}.`
      );
    }

    let extractedData: Record<string, unknown> | null = null;
    if (documentType === 'RPA' && isPdfDocument) {
      try {
        const parsedData = await parseRPADocument(fileBuffer);
        extractedData = {
          ...parsedData,
          parserStatus: 'AUTO_OK',
          parserMessage: 'Leitura automática concluída com sucesso.',
          manualOverride: false,
        };
      } catch (parseError) {
        extractedData = {
          parserStatus: 'AUTO_FAILED',
          parserMessage: parseError instanceof Error ? parseError.message : 'Falha ao ler a RPA.',
          manualOverride: false,
        };
        warnings.push('Nao foi possivel extrair os dados automaticamente da RPA. Voce pode preencher manualmente.');
      }
    }

    const document = await registerFinancialDocument({
      financialClosingId: closing.id,
      financialClosingLineId: line?.id ?? null,
      physiotherapistId,
      type: documentType,
      status: uploaded ? FinancialDocumentStatus.AVAILABLE : FinancialDocumentStatus.PENDING,
      fileName: uploaded?.fileName || fileName,
      fileId: uploaded?.fileId ?? null,
      fileUrl: uploaded?.webViewLink ?? null,
      mimeType,
      fileHash: crypto.createHash('sha256').update(fileBuffer).digest('hex'),
      folderPath: uploaded?.folderPath?.join(' / ') || null,
      referenceMonth: month,
      metadata: {
        source: isJson ? payload.source ?? 'manual' : 'manual',
        folderId: uploaded?.folderId ?? null,
        folderPath: uploaded?.folderPath ?? [],
        rootFolderName: uploaded?.rootFolderName ?? null,
        driveWarning: warnings[0] ?? null,
      },
      extractedData: extractedData as never,
      uploadedBy: normalizeUserId(user?.id),
      uploadedAt: new Date(),
    });

    let synchronizedDocument = document;
    let appliedToClosing = false;
    if (documentType === 'RPA' && extractedData) {
      try {
        const syncResult = await syncFinancialRpaDocument(document.id, {
          actorUserId: normalizeUserId(user?.id),
          rpaData: extractedData,
          parserStatus:
            extractedData.parserStatus === 'AUTO_OK' ? 'AUTO_OK' : 'AUTO_FAILED',
          parserMessage: typeof extractedData.parserMessage === 'string' ? extractedData.parserMessage : null,
          manualOverride: false,
          applyToClosing: extractedData.parserStatus === 'AUTO_OK',
        });
        synchronizedDocument = syncResult.document;
        appliedToClosing = syncResult.appliedToClosing;
      } catch (syncError) {
        warnings.push(
          `A RPA foi anexada, mas os valores nao puderam ser aplicados automaticamente: ${syncError instanceof Error ? syncError.message : 'falha desconhecida'}.`
        );
      }
    }

    return NextResponse.json({
      success: true,
      document: synchronizedDocument,
      drive: uploaded,
      extractedData: synchronizedDocument.extractedData ?? extractedData,
      appliedToClosing,
      warnings,
    });
  } catch (routeError) {
    return NextResponse.json(
      { error: routeError instanceof Error ? routeError.message : 'Erro ao anexar documento financeiro.' },
      { status: 400 }
    );
  }
}
