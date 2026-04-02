import {
  ensureDriveFolderPath,
  listFilesInDriveFolder,
  type DriveFileInfo,
  type DriveUploadResult,
  uploadBufferToDrive,
} from '@/lib/google-drive';

export const FINANCIAL_DOCUMENT_ROOT_FOLDER = 'Documentos Financeiros';

export const FINANCIAL_DOCUMENT_TYPES = [
  'RPA',
  'NF',
  'PIX_RECEIPT',
  'BANK_FILE',
  'BANK_RETURN',
  'OTHER',
] as const;

export type FinancialDocumentType = (typeof FINANCIAL_DOCUMENT_TYPES)[number];

export type FinancialDocumentSource = 'manual' | 'bank_api' | 'system' | 'import';

export interface FinancialDocumentFolderOptions {
  physiotherapistName: string;
  competence: string;
  documentType: FinancialDocumentType;
  rootFolderName?: string;
}

export interface FinancialDocumentUploadInput extends FinancialDocumentFolderOptions {
  buffer: Buffer;
  fileName?: string;
  mimeType: string;
  source?: FinancialDocumentSource;
}

export interface FinancialDocumentMetadata {
  fileId: string;
  fileName: string;
  webViewLink: string;
  folderId: string;
  folderPath: string[];
  rootFolderName: string;
  physiotherapistName: string;
  competence: string;
  documentType: FinancialDocumentType;
  source: FinancialDocumentSource;
}

export interface FinancialDocumentFile extends DriveFileInfo {
  folderPath: string[];
  rootFolderName: string;
  physiotherapistName: string;
  competence: string;
  documentType: FinancialDocumentType;
}

export function normalizeCompetence(value: string): string {
  const trimmed = value.trim();
  const directMatch = trimmed.match(/^(\d{4})-(\d{2})$/);

  if (directMatch) {
    return `${directMatch[1]}-${directMatch[2]}`;
  }

  const altMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})$/);

  if (altMatch) {
    return `${altMatch[1]}-${altMatch[2].padStart(2, '0')}`;
  }

  throw new Error('Competencia invalida. Use o formato YYYY-MM.');
}

export function sanitizeDriveSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getFinancialDocumentTypeLabel(documentType: FinancialDocumentType): string {
  switch (documentType) {
    case 'RPA':
      return 'RPA';
    case 'NF':
      return 'Notas Fiscais';
    case 'PIX_RECEIPT':
      return 'Comprovantes PIX';
    case 'BANK_FILE':
      return 'Arquivos Bancarios';
    case 'BANK_RETURN':
      return 'Retornos Bancarios';
    default:
      return 'Outros Documentos';
  }
}

export function buildFinancialDocumentFolderNames(options: FinancialDocumentFolderOptions): string[] {
  return [
    options.rootFolderName?.trim() || FINANCIAL_DOCUMENT_ROOT_FOLDER,
    sanitizeDriveSegment(options.physiotherapistName),
    normalizeCompetence(options.competence),
    getFinancialDocumentTypeLabel(options.documentType),
  ];
}

export function buildFinancialDocumentFileName(options: FinancialDocumentFolderOptions & { originalFileName?: string }): string {
  const normalizedCompetence = normalizeCompetence(options.competence);
  const typeLabel = getFinancialDocumentTypeLabel(options.documentType).replace(/\s+/g, '_');
  const physioName = sanitizeDriveSegment(options.physiotherapistName).replace(/\s+/g, '_');
  const originalFileName = options.originalFileName?.trim();
  const extensionMatch = originalFileName ? originalFileName.match(/\.([a-zA-Z0-9]+)$/) : null;
  const extension = extensionMatch?.[1]?.toLowerCase() || 'pdf';

  return `${normalizedCompetence}_${typeLabel}_${physioName}.${extension}`;
}

export async function ensureFinancialDocumentFolderPath(
  options: FinancialDocumentFolderOptions
): Promise<{ folderId: string; folderPath: string[] }> {
  const folderPath = buildFinancialDocumentFolderNames(options);
  const folderId = await ensureDriveFolderPath(folderPath);

  return { folderId, folderPath };
}

export async function uploadFinancialDocumentToDrive(
  input: FinancialDocumentUploadInput
): Promise<FinancialDocumentMetadata & DriveUploadResult> {
  const folder = await ensureFinancialDocumentFolderPath(input);
  const fileName = input.fileName?.trim() || buildFinancialDocumentFileName(input);
  const uploadResult = await uploadBufferToDrive(
    input.buffer,
    fileName,
    input.mimeType,
    folder.folderPath
  );

  return {
    ...uploadResult,
    fileId: uploadResult.fileId,
    fileName: uploadResult.fileName,
    webViewLink: uploadResult.webViewLink,
    folderId: folder.folderId,
    folderPath: folder.folderPath,
    rootFolderName: input.rootFolderName?.trim() || FINANCIAL_DOCUMENT_ROOT_FOLDER,
    physiotherapistName: input.physiotherapistName,
    competence: normalizeCompetence(input.competence),
    documentType: input.documentType,
    source: input.source || 'manual',
  };
}

export async function listFinancialDocumentsFromDrive(
  options: FinancialDocumentFolderOptions
): Promise<FinancialDocumentFile[]> {
  const folderPath = buildFinancialDocumentFolderNames(options);
  const files = await listFilesInDriveFolder(folderPath);

  return files.map((file) => ({
    ...file,
    folderPath,
    rootFolderName: options.rootFolderName?.trim() || FINANCIAL_DOCUMENT_ROOT_FOLDER,
    physiotherapistName: options.physiotherapistName,
    competence: normalizeCompetence(options.competence),
    documentType: options.documentType,
  }));
}
