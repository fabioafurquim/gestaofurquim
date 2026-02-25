import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const CREDENTIALS_PATH = path.join(process.cwd(), 'google-credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'google-token.json');

// URL base da aplicação (usa variável de ambiente ou localhost como fallback)
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
const REDIRECT_URI = `${BASE_URL}/api/auth/google/callback`;

// Scopes necessários para Drive e Gmail
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
];

/**
 * Carrega as credenciais do Google
 */
function loadCredentials(): { client_id: string; client_secret: string; redirect_uris: string[] } {
  try {
    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    return credentials.installed || credentials.web;
  } catch (error) {
    throw new Error('Arquivo google-credentials.json não encontrado. Configure as credenciais do Google.');
  }
}

/**
 * Carrega o token salvo
 */
function loadToken(): { access_token: string; refresh_token: string; token_type: string; expiry_date: number } | null {
  try {
    const content = fs.readFileSync(TOKEN_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Salva o token
 */
function saveToken(token: object): void {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

/**
 * Obtém um cliente OAuth2 autenticado
 */
export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const credentials = loadCredentials();
  const oAuth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    REDIRECT_URI
  );

  const token = loadToken();
  if (token) {
    oAuth2Client.setCredentials(token);
    
    // Verifica se o token expirou e tenta renovar
    if (token.expiry_date && token.expiry_date < Date.now()) {
      console.log('Token expirado, tentando renovar...');
      try {
        const { credentials: newCredentials } = await oAuth2Client.refreshAccessToken();
        saveToken(newCredentials);
        oAuth2Client.setCredentials(newCredentials);
        console.log('Token renovado com sucesso');
      } catch (error) {
        console.error('Erro ao renovar token:', error);
        // Remove o token inválido para forçar reautenticação
        deleteToken();
        throw new Error('Token expirado. Clique em "Configurar Google" para reautenticar.');
      }
    }
    
    return oAuth2Client;
  }

  throw new Error('Token não encontrado. Execute o script de autenticação primeiro.');
}

/**
 * Remove o token salvo
 */
export function deleteToken(): void {
  try {
    fs.unlinkSync(TOKEN_PATH);
    console.log('Token removido');
  } catch {
    // Ignora se não existir
  }
}

/**
 * Gera a URL de autorização
 */
export function getAuthUrl(): string {
  const credentials = loadCredentials();
  const oAuth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    REDIRECT_URI
  );

  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

/**
 * Troca o código de autorização por tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<void> {
  const credentials = loadCredentials();
  const oAuth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    REDIRECT_URI
  );

  const { tokens } = await oAuth2Client.getToken(code);
  saveToken(tokens);
}

/**
 * Verifica se está autenticado (tem token e refresh_token)
 */
export function isAuthenticated(): boolean {
  const token = loadToken();
  // Precisa ter access_token E refresh_token para poder renovar quando expirar
  return token !== null && token.access_token !== undefined && token.refresh_token !== undefined;
}

// ==========================================
// FUNÇÕES DO GOOGLE DRIVE
// ==========================================

interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
}

/**
 * Obtém ou cria a pasta raiz de pagamentos
 */
async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  folderName: string,
  parentId?: string
): Promise<string> {
  // Busca a pasta
  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
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

  // Cria a pasta
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

/**
 * Cria a estrutura de pastas para um fisioterapeuta
 * Estrutura: Pagamentos Fisioterapeutas / [Nome do Fisioterapeuta] / [Ano] / [Tipo de Documento]
 */
async function ensureFolderStructure(
  drive: ReturnType<typeof google.drive>,
  physiotherapistName: string,
  year: string,
  documentType: 'RPA' | 'Notas Fiscais' | 'Comprovantes PIX'
): Promise<string> {
  // Pasta raiz
  const rootFolderId = await getOrCreateFolder(drive, 'Pagamentos Fisioterapeutas');
  
  // Pasta do fisioterapeuta
  const physioFolderId = await getOrCreateFolder(drive, physiotherapistName, rootFolderId);
  
  // Pasta do ano
  const yearFolderId = await getOrCreateFolder(drive, year, physioFolderId);
  
  // Pasta do tipo de documento
  const docTypeFolderId = await getOrCreateFolder(drive, documentType, yearFolderId);
  
  return docTypeFolderId;
}

/**
 * Faz upload de um arquivo para o Google Drive
 */
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

  // Garante a estrutura de pastas
  const folderId = await ensureFolderStructure(drive, physiotherapistName, year, documentType);

  // Faz o upload
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: require('stream').Readable.from(fileBuffer),
    },
    fields: 'id, name, webViewLink',
  });

  return {
    fileId: response.data.id!,
    fileName: response.data.name!,
    webViewLink: response.data.webViewLink || '',
  };
}

/**
 * Obtém um arquivo do Google Drive
 */
export async function getFileFromDrive(fileId: string): Promise<Buffer> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Deleta um arquivo do Google Drive
 */
export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const auth = await getAuthenticatedClient();
  const drive = google.drive({ version: 'v3', auth });

  await drive.files.delete({ fileId });
}
