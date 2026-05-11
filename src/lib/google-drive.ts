import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

import {
  clearGoogleTokenFromDatabase,
  getGoogleTokenUpdatedAt,
  loadGoogleTokenFromDatabase,
  saveGoogleTokenToDatabase,
  type GoogleTokenShape,
} from '@/lib/google-auth-storage';

const CREDENTIALS_PATH = path.join(process.cwd(), 'google-credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'google-token.json');

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
const DEFAULT_RETURN_TO = '/maintenance?tab=backup';
const REDIRECT_URI = `${BASE_URL}/api/auth/google/callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
];

type GoogleCredentialsShape = {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
};

type GoogleCredentials = {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
};

type TokenSource = 'database' | 'environment' | 'file';

type GoogleTokenCandidate = {
  token: GoogleTokenShape;
  source: TokenSource;
};

function normalizeGoogleToken(token: GoogleTokenShape): GoogleTokenShape {
  return {
    access_token: token.access_token ?? undefined,
    refresh_token: token.refresh_token ?? undefined,
    token_type: token.token_type ?? undefined,
    expiry_date: token.expiry_date ?? undefined,
    scope: token.scope ?? undefined,
  };
}

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  folderId?: string;
  folderPath?: string[];
}

export interface DriveFolderResolution {
  folderId: string;
  folderPath: string[];
}

export interface DriveFileInfo {
  fileId: string;
  fileName: string;
  webViewLink: string;
  mimeType?: string | null;
  size?: string | null;
  createdTime?: string | null;
  modifiedTime?: string | null;
}

export interface GoogleAuthStatus {
  authenticated: boolean;
  authUrl: string;
  message: string;
  reauthRequired: boolean;
  tokenUpdatedAt: string | null;
}

function decodeJsonEnv(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith('{')) {
    return trimmed;
  }

  return Buffer.from(trimmed, 'base64').toString('utf-8');
}

function readJsonFromEnv<T>(envNames: string[]): T | null {
  for (const envName of envNames) {
    const rawValue = process.env[envName];

    if (!rawValue) {
      continue;
    }

    try {
      return JSON.parse(decodeJsonEnv(rawValue)) as T;
    } catch (error) {
      throw new Error(`Variavel ${envName} invalida. Verifique o JSON informado.`);
    }
  }

  return null;
}

function loadCredentials(): GoogleCredentials {
  const envCredentials = readJsonFromEnv<GoogleCredentialsShape>([
    'GOOGLE_CREDENTIALS_JSON',
    'GOOGLE_CREDENTIALS_JSON_BASE64',
  ]);

  if (envCredentials) {
    const credentials = envCredentials.installed || envCredentials.web;

    if (!credentials?.client_id || !credentials.client_secret) {
      throw new Error('Credenciais Google invalidas nas variaveis de ambiente.');
    }

    return {
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      redirect_uris: credentials.redirect_uris || [REDIRECT_URI],
    };
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uris: [REDIRECT_URI],
    };
  }

  try {
    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const credentials = JSON.parse(content) as GoogleCredentialsShape;
    const parsed = credentials.installed || credentials.web;

    if (!parsed?.client_id || !parsed.client_secret) {
      throw new Error('Arquivo de credenciais do Google invalido.');
    }

    return {
      client_id: parsed.client_id,
      client_secret: parsed.client_secret,
      redirect_uris: parsed.redirect_uris || [REDIRECT_URI],
    };
  } catch {
    throw new Error(
      'Credenciais do Google nao encontradas. Configure GOOGLE_CREDENTIALS_JSON/GOOGLE_CLIENT_ID no ambiente ou mantenha google-credentials.json local.'
    );
  }
}

function loadTokenFromEnv(): GoogleTokenShape | null {
  return readJsonFromEnv<GoogleTokenShape>([
    'GOOGLE_TOKEN_JSON',
    'GOOGLE_TOKEN_JSON_BASE64',
  ]);
}

function loadTokenFromFile(): GoogleTokenShape | null {
  try {
    const content = fs.readFileSync(TOKEN_PATH, 'utf-8');
    return JSON.parse(content) as GoogleTokenShape;
  } catch {
    return null;
  }
}

function hasEmbeddedGoogleToken() {
  return Boolean(process.env.GOOGLE_TOKEN_JSON || process.env.GOOGLE_TOKEN_JSON_BASE64);
}

function saveTokenToFile(token: GoogleTokenShape): void {
  if (hasEmbeddedGoogleToken()) {
    return;
  }

  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

async function deleteTokenFileIfPossible(): Promise<void> {
  if (hasEmbeddedGoogleToken()) {
    return;
  }

  try {
    fs.unlinkSync(TOKEN_PATH);
  } catch {
    // Ignora se nao existir
  }
}

function getTokenSignature(token: GoogleTokenShape) {
  return JSON.stringify({
    access_token: token.access_token || null,
    refresh_token: token.refresh_token || null,
    expiry_date: token.expiry_date || null,
  });
}

async function loadTokenCandidates(): Promise<GoogleTokenCandidate[]> {
  const candidates: GoogleTokenCandidate[] = [];
  const seenSignatures = new Set<string>();

  const registerCandidate = (token: GoogleTokenShape | null, source: TokenSource) => {
    if (!token?.access_token && !token?.refresh_token) {
      return;
    }

    const signature = getTokenSignature(token);
    if (seenSignatures.has(signature)) {
      return;
    }

    seenSignatures.add(signature);
    candidates.push({ token, source });
  };

  registerCandidate(await loadGoogleTokenFromDatabase(), 'database');
  registerCandidate(loadTokenFromEnv(), 'environment');
  registerCandidate(loadTokenFromFile(), 'file');

  return candidates;
}

async function persistToken(token: GoogleTokenShape, source: TokenSource | 'oauth' = 'oauth') {
  const normalizedToken = normalizeGoogleToken(token);

  await saveGoogleTokenToDatabase(normalizedToken);

  if (source === 'file' || (!hasEmbeddedGoogleToken() && source === 'oauth')) {
    saveTokenToFile(normalizedToken);
  }
}

function createOAuthClient() {
  const credentials = loadCredentials();

  return new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    REDIRECT_URI
  );
}

function sanitizeReturnTo(returnTo?: string | null) {
  if (!returnTo || !returnTo.startsWith('/')) {
    return DEFAULT_RETURN_TO;
  }

  return returnTo;
}

function isGoogleReauthError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes('invalid_grant') ||
    message.includes('invalid_rapt') ||
    message.includes('reauth') ||
    message.includes('token do google expirado') ||
    message.includes('invalid credentials')
  );
}

async function validateTokenCandidate(candidate: GoogleTokenCandidate) {
  const oAuth2Client = createOAuthClient();
  oAuth2Client.setCredentials(candidate.token);

  let credentials = { ...candidate.token };

  try {
    const accessTokenResult = await oAuth2Client.getAccessToken();
    const freshAccessToken = accessTokenResult?.token;

    if (freshAccessToken && freshAccessToken !== credentials.access_token) {
      credentials = {
        ...credentials,
        access_token: freshAccessToken,
      };
      oAuth2Client.setCredentials(credentials);
    }

    if (!credentials.access_token) {
      throw new Error('Token do Google nao possui access_token valido.');
    }

    await persistToken(credentials, candidate.source);

    return oAuth2Client;
  } catch (error) {
    console.error(`Falha ao validar token do Google vindo de ${candidate.source}:`, error);
    throw error;
  }
}

export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const candidates = await loadTokenCandidates();

  if (candidates.length === 0) {
    throw new Error('Token do Google nao encontrado. Configure a autenticacao antes de usar o Drive.');
  }

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      return await validateTokenCandidate(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError && isGoogleReauthError(lastError)) {
    await clearGoogleTokenFromDatabase();
    await deleteTokenFileIfPossible();
    throw new Error('Token do Google expirado ou revogado. Refaça a autenticacao.');
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('Nao foi possivel autenticar com o Google Drive.');
}

export function getAuthUrl(returnTo?: string): string {
  const oAuth2Client = createOAuthClient();

  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: sanitizeReturnTo(returnTo),
  });
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const oAuth2Client = createOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);

  await persistToken(tokens as GoogleTokenShape, 'oauth');
}

export async function deleteToken(): Promise<void> {
  await clearGoogleTokenFromDatabase();
  await deleteTokenFileIfPossible();
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    await getAuthenticatedClient();
    return true;
  } catch {
    return false;
  }
}

export async function getGoogleAuthStatus(returnTo?: string): Promise<GoogleAuthStatus> {
  const authUrl = getAuthUrl(returnTo);
  const tokenUpdatedAt = await getGoogleTokenUpdatedAt();

  try {
    await getAuthenticatedClient();
    return {
      authenticated: true,
      authUrl,
      message: 'Google Drive autenticado e pronto para uso.',
      reauthRequired: false,
      tokenUpdatedAt: tokenUpdatedAt?.toISOString() || null,
    };
  } catch (error) {
    return {
      authenticated: false,
      authUrl,
      message:
        error instanceof Error
          ? error.message
          : 'Google Drive nao autenticado. Configure a integracao para continuar.',
      reauthRequired: true,
      tokenUpdatedAt: tokenUpdatedAt?.toISOString() || null,
    };
  }
}

export function getAuthReturnPathFromState(state?: string | null) {
  return sanitizeReturnTo(state);
}

async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  folderName: string,
  parentId?: string
): Promise<string> {
  let query = `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id!;
  }

  const fileMetadata: { name: string; mimeType: string; parents?: string[] } = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id',
  });

  return folder.data.id!;
}

async function resolveDriveFolderPath(
  folderNames: string[],
  createIfMissing: boolean
): Promise<DriveFolderResolution | null> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth });

  let parentId: string | undefined;
  const resolvedPath: string[] = [];

  for (const folderName of folderNames) {
    resolvedPath.push(folderName);

    let query = `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const existingFolder = response.data.files?.[0];

    if (existingFolder?.id) {
      parentId = existingFolder.id;
      continue;
    }

    if (!createIfMissing) {
      return null;
    }

    parentId = await getOrCreateFolder(drive, folderName, parentId);
  }

  if (!parentId) {
    return null;
  }

  return {
    folderId: parentId,
    folderPath: resolvedPath,
  };
}

export async function ensureDriveFolderPath(folderNames: string[]): Promise<string> {
  const resolution = await resolveDriveFolderPath(folderNames, true);

  if (!resolution) {
    throw new Error('Nao foi possivel resolver a pasta do Drive.');
  }

  return resolution.folderId;
}

export async function findDriveFolderPath(folderNames: string[]): Promise<DriveFolderResolution | null> {
  return resolveDriveFolderPath(folderNames, false);
}

export async function uploadBufferToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderNames: string[]
): Promise<DriveUploadResult> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth });
  const folderResolution = await resolveDriveFolderPath(folderNames, true);

  if (!folderResolution) {
    throw new Error('Nao foi possivel criar a pasta no Drive.');
  }

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderResolution.folderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: 'id, name, webViewLink',
  });

  return {
    fileId: response.data.id!,
    fileName: response.data.name!,
    webViewLink: response.data.webViewLink || '',
    folderId: folderResolution.folderId,
    folderPath: folderResolution.folderPath,
  };
}

export async function listFilesInDriveFolder(folderNames: string[]): Promise<DriveFileInfo[]> {
  const folderResolution = await findDriveFolderPath(folderNames);

  if (!folderResolution) {
    return [];
  }

  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.list({
    q: `'${folderResolution.folderId}' in parents and trashed=false`,
    fields: 'files(id, name, webViewLink, mimeType, size, createdTime, modifiedTime)',
    spaces: 'drive',
  });

  return (response.data.files || [])
    .map((file) => ({
      fileId: file.id || '',
      fileName: file.name || '',
      webViewLink: file.webViewLink || '',
      mimeType: file.mimeType || null,
      size: file.size || null,
      createdTime: file.createdTime || null,
      modifiedTime: file.modifiedTime || null,
    }))
    .filter((file) => Boolean(file.fileId));
}

async function ensurePaymentFolderStructure(
  drive: ReturnType<typeof google.drive>,
  physiotherapistName: string,
  year: string,
  documentType: 'RPA' | 'Notas Fiscais' | 'Comprovantes PIX'
): Promise<string> {
  const rootFolderId = await getOrCreateFolder(drive, 'Pagamentos Fisioterapeutas');
  const physioFolderId = await getOrCreateFolder(drive, physiotherapistName, rootFolderId);
  const yearFolderId = await getOrCreateFolder(drive, year, physioFolderId);
  const docTypeFolderId = await getOrCreateFolder(drive, documentType, yearFolderId);

  return docTypeFolderId;
}

export async function uploadFileToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  physiotherapistName: string,
  year: string,
  documentType: 'RPA' | 'Notas Fiscais' | 'Comprovantes PIX'
): Promise<DriveUploadResult> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth });
  const folderId = await ensurePaymentFolderStructure(drive, physiotherapistName, year, documentType);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: 'id, name, webViewLink',
  });

  return {
    fileId: response.data.id!,
    fileName: response.data.name!,
    webViewLink: response.data.webViewLink || '',
  };
}

export async function getFileFromDrive(fileId: string): Promise<Buffer> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth });

  await drive.files.delete({ fileId });
}
