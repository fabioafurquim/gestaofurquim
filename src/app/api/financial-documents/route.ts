import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import {
  buildFinancialDocumentFileName,
  FINANCIAL_DOCUMENT_ROOT_FOLDER,
  FINANCIAL_DOCUMENT_TYPES,
  getFinancialDocumentTypeLabel,
  listFinancialDocumentsFromDrive,
  normalizeCompetence,
  uploadFinancialDocumentToDrive,
} from '@/lib/financial-documents';

export const runtime = 'nodejs';

const documentTypeSchema = z.enum(FINANCIAL_DOCUMENT_TYPES);

const listQuerySchema = z.object({
  physiotherapistName: z.string().trim().min(1),
  competence: z.string().trim().min(1),
  documentType: z.enum(FINANCIAL_DOCUMENT_TYPES).optional(),
  rootFolderName: z.string().trim().optional(),
});

const uploadSchema = z.object({
  physiotherapistName: z.string().trim().min(1),
  competence: z.string().trim().min(1),
  documentType: z.enum(FINANCIAL_DOCUMENT_TYPES),
  rootFolderName: z.string().trim().optional(),
  source: z.enum(['manual', 'bank_api', 'system', 'import']).optional(),
  fileName: z.string().trim().optional(),
});

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function bufferFromBase64(contentBase64: string) {
  const normalized = contentBase64.includes('base64,')
    ? contentBase64.split('base64,').pop() || ''
    : contentBase64;

  return Buffer.from(normalized, 'base64');
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdminOrManager();

  if (error) {
    return error;
  }

  try {
    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      physiotherapistName: url.searchParams.get('physiotherapistName') || '',
      competence: url.searchParams.get('competence') || '',
      documentType: url.searchParams.get('documentType') || undefined,
      rootFolderName: url.searchParams.get('rootFolderName') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Informe physiotherapistName e competence para listar documentos.' },
        { status: 400 }
      );
    }

    const competence = normalizeCompetence(parsed.data.competence);
    const documentTypes = parsed.data.documentType
      ? [parsed.data.documentType]
      : [...FINANCIAL_DOCUMENT_TYPES];

    const documents = (
      await Promise.all(
        documentTypes.map((documentType) =>
          listFinancialDocumentsFromDrive({
            physiotherapistName: parsed.data.physiotherapistName,
            competence,
            documentType,
            rootFolderName: parsed.data.rootFolderName || FINANCIAL_DOCUMENT_ROOT_FOLDER,
          })
        )
      )
    )
      .flat()
      .sort((a, b) => {
        const aTime = a.modifiedTime || a.createdTime || '';
        const bTime = b.modifiedTime || b.createdTime || '';
        return bTime.localeCompare(aTime);
      });

    return NextResponse.json({
      success: true,
      rootFolderName: parsed.data.rootFolderName || FINANCIAL_DOCUMENT_ROOT_FOLDER,
      physiotherapistName: parsed.data.physiotherapistName,
      competence,
      documents,
      total: documents.length,
      documentTypes: documentTypes.map((documentType) => ({
        value: documentType,
        label: getFinancialDocumentTypeLabel(documentType),
      })),
    });
  } catch (error) {
    console.error('Erro ao listar documentos financeiros:', error);
    return NextResponse.json(
      { error: 'Erro ao listar documentos financeiros' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdminOrManager();

  if (error) {
    return error;
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    const rawPayload = isJson
      ? await request.json()
      : await request.formData();

    const file = isJson ? null : (rawPayload.get('file') as FormDataEntryValue | null);

    const parsed = uploadSchema.safeParse(
      isJson
        ? {
            physiotherapistName: typeof rawPayload.physiotherapistName === 'string' ? rawPayload.physiotherapistName.trim() : '',
            competence: typeof rawPayload.competence === 'string' ? rawPayload.competence.trim() : '',
            documentType: typeof rawPayload.documentType === 'string' ? rawPayload.documentType.trim() : '',
            rootFolderName: typeof rawPayload.rootFolderName === 'string' ? rawPayload.rootFolderName.trim() : undefined,
            source: typeof rawPayload.source === 'string' ? rawPayload.source.trim() : undefined,
            fileName: typeof rawPayload.fileName === 'string' ? rawPayload.fileName.trim() : undefined,
          }
        : {
            physiotherapistName: getFormValue(rawPayload as FormData, 'physiotherapistName'),
            competence: getFormValue(rawPayload as FormData, 'competence'),
            documentType: getFormValue(rawPayload as FormData, 'documentType'),
            rootFolderName: getFormValue(rawPayload as FormData, 'rootFolderName') || undefined,
            source: getFormValue(rawPayload as FormData, 'source')
              ? (getFormValue(rawPayload as FormData, 'source') as 'manual' | 'bank_api' | 'system' | 'import')
              : undefined,
            fileName: getFormValue(rawPayload as FormData, 'fileName') || undefined,
          }
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Informe physiotherapistName, competence e documentType.' },
        { status: 400 }
      );
    }

    const documentType = documentTypeSchema.parse(parsed.data.documentType);
    const competence = normalizeCompetence(parsed.data.competence);
    const providedBuffer = isJson
      ? typeof rawPayload.contentBase64 === 'string'
        ? bufferFromBase64(rawPayload.contentBase64)
        : null
      : file instanceof File
        ? Buffer.from(await file.arrayBuffer())
        : null;

    if (!providedBuffer) {
      return NextResponse.json(
        { error: 'Envie um arquivo no campo file ou contentBase64 no JSON.' },
        { status: 400 }
      );
    }

    if (providedBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: 'Arquivo vazio.' },
        { status: 400 }
      );
    }

    const uploaded = await uploadFinancialDocumentToDrive({
      buffer: providedBuffer,
      fileName: parsed.data.fileName || buildFinancialDocumentFileName({
        physiotherapistName: parsed.data.physiotherapistName,
        competence,
        documentType,
        originalFileName: !isJson && file instanceof File ? file.name : parsed.data.fileName,
      }),
      mimeType: isJson
        ? (typeof rawPayload.mimeType === 'string' && rawPayload.mimeType.trim()) || 'application/octet-stream'
        : file instanceof File
          ? file.type || 'application/octet-stream'
          : 'application/octet-stream',
      physiotherapistName: parsed.data.physiotherapistName,
      competence,
      documentType,
      rootFolderName: parsed.data.rootFolderName || FINANCIAL_DOCUMENT_ROOT_FOLDER,
      source: parsed.data.source || 'manual',
    });

    return NextResponse.json({
      success: true,
      document: uploaded,
    });
  } catch (error) {
    console.error('Erro ao enviar documento financeiro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao enviar documento financeiro' },
      { status: 500 }
    );
  }
}
