import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const CREDENTIALS_PATH = path.join(process.cwd(), 'google-credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'google-token.json');

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
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

type GoogleTokenShape = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expiry_date?: number;
};

type GoogleCredentials = {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
};

interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
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
      throw new Error(`Variável ${envName} inválida. Verifique o JSON informado.`);
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
      throw new Error('Credenciais Google inválidas nas variáveis de ambiente.');
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
      throw new Error('Arquivo de credenciais do Google inválido.');
    }

    return {
      client_id: parsed.client_id,
      client_secret: parsed.client_secret,
      redirect_uris: parsed.redirect_uris || [REDIRECT_URI],
    };
  } catch (error) {
    throw new Error(
      'Credenciais do Google não encontradas. Configure GOOGLE_CREDENTIALS_JSON/GOOGLE_CLIENT_ID no ambiente ou mantenha google-credentials.json local.'
    );
  }
}

function loadToken(): GoogleTokenShape | null {
  const envToken = readJsonFromEnv<GoogleTokenShape>([
    'GOOGLE_TOKEN_JSON',
    'GOOGLE_TOKEN_JSON_BASE64',
  ]);

  if (envToken) {
    return envToken;
  }

  try {
    const content = fs.readFileSync(TOKEN_PATH, 'utf-8');
    return JSON.parse(content) as GoogleTokenShape;
  } catch {
    return null;
  }
}

function canPersistTokenToFile() {
  return !process.env.GOOGLE_TOKEN_JSON && !process.env.GOOGLE_TOKEN_JSON_BASE64;
}

function saveToken(token: object): void {
  if (!canPersistTokenToFile()) {
    console.warn('Token do Google veio por variável de ambiente; atualização não será persistida em arquivo.');
    return;
  }

  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

export function deleteToken(): void {
  if (!canPersistTokenToFile()) {
    console.warn('Token do Google está configurado via variável de ambiente; remova-o manualmente no Coolify se necessário.');
    return;
  }

  try {
    fs.unlinkSync(TOKEN_PATH);
    console.log('Token removido');
  } catch {
    // Ignora se não existir
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

export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const oAuth2Client = createOAuthClient();
  const token = loadToken();

  if (!token) {
    throw new Error('Token do Google não encontrado. Configure a autenticação antes de usar o Drive.');
  }

  oAuth2Client.setCredentials(token);

  if (token.expiry_date && token.expiry_date < Date.now() && token.refresh_token) {
    console.log('Token do Google expirado, tentando renovar...');

    try {
      const { credentials: newCredentials } = await oAuth2Client.refreshAccessToken();
      const mergedCredentials = {
        ...token,
        ...newCredentials,
        refresh_token: newCredentials.refresh_token || token.refresh_token,
      };

      saveToken(mergedCredentials);
      oAuth2Client.setCredentials(mergedCredentials);
      console.log('Token do Google renovado com sucesso');
    } catch (error) {
      console.error('Erro ao renovar token do Google:', error);

      if (canPersistTokenToFile()) {
        deleteToken();
      }

      throw new Error('Token do Google expirado. Refaça a autenticação.');
    }
  }

  return oAuth2Client;
}

export function getAuthUrl(): string {
  const oAuth2Client = createOAuthClient();

  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const oAuth2Client = createOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);

  saveToken(tokens);
}

export function isAuthenticated(): boolean {
  const token = loadToken();
  return Boolean(token?.access_token && token?.refresh_token);
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

export async function ensureDriveFolderPath(folderNames: string[]): Promise<string> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth });

  let parentId: string | undefined;

  for (const folderName of folderNames) {
    parentId = await getOrCreateFolder(drive, folderName, parentId);
  }

  return parentId!;
}

export async function uploadBufferToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderNames: string[]
): Promise<DriveUploadResult> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth });
  const folderId = await ensureDriveFolderPath(folderNames);

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
