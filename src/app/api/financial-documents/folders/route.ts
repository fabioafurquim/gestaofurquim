import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdminOrManager } from '@/lib/auth-helpers';
import {
  FINANCIAL_DOCUMENT_ROOT_FOLDER,
  FINANCIAL_DOCUMENT_TYPES,
  getFinancialDocumentTypeLabel,
  normalizeCompetence,
  ensureFinancialDocumentFolderPath,
} from '@/lib/financial-documents';

export const runtime = 'nodejs';

const folderSchema = z.object({
  physiotherapistName: z.string().trim().min(1),
  competence: z.string().trim().min(1),
  documentType: z.enum(FINANCIAL_DOCUMENT_TYPES),
  rootFolderName: z.string().trim().optional(),
});

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdminOrManager();

  if (error) {
    return error;
  }

  try {
    const formData = await request.formData();
    const parsed = folderSchema.safeParse({
      physiotherapistName: readString(formData, 'physiotherapistName'),
      competence: readString(formData, 'competence'),
      documentType: readString(formData, 'documentType'),
      rootFolderName: readString(formData, 'rootFolderName') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Informe physiotherapistName, competence e documentType.' },
        { status: 400 }
      );
    }

    const competence = normalizeCompetence(parsed.data.competence);
    const folder = await ensureFinancialDocumentFolderPath({
      physiotherapistName: parsed.data.physiotherapistName,
      competence,
      documentType: parsed.data.documentType,
      rootFolderName: parsed.data.rootFolderName || FINANCIAL_DOCUMENT_ROOT_FOLDER,
    });

    return NextResponse.json({
      success: true,
      folder: {
        ...folder,
        rootFolderName: parsed.data.rootFolderName || FINANCIAL_DOCUMENT_ROOT_FOLDER,
        physiotherapistName: parsed.data.physiotherapistName,
        competence,
        documentType: parsed.data.documentType,
        documentTypeLabel: getFinancialDocumentTypeLabel(parsed.data.documentType),
      },
    });
  } catch (error) {
    console.error('Erro ao resolver pasta financeira:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao resolver pasta financeira' },
      { status: 500 }
    );
  }
}
