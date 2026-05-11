import crypto from 'crypto';

import { prisma } from '@/lib/prisma';

export type GoogleTokenShape = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expiry_date?: number;
  scope?: string;
};

const ENCRYPTION_VERSION = 'v1';

function getEncryptionSecret() {
  const secret =
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CRON_SECRET;

  if (!secret) {
    throw new Error(
      'Nenhum segredo de criptografia disponivel para armazenar o token do Google com seguranca.'
    );
  }

  return crypto.createHash('sha256').update(secret).digest();
}

function encryptPayload(payload: string) {
  const key = getEncryptionSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_VERSION}:${Buffer.concat([iv, authTag, encrypted]).toString('base64')}`;
}

function decryptPayload(encryptedValue: string) {
  const [version, encodedPayload] = encryptedValue.split(':', 2);

  if (version !== ENCRYPTION_VERSION || !encodedPayload) {
    throw new Error('Formato de token criptografado do Google invalido.');
  }

  const payload = Buffer.from(encodedPayload, 'base64');
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const key = getEncryptionSecret();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

async function ensureSystemSettingsRow() {
  let settings = await prisma.systemSettings.findFirst({
    select: { id: true },
  });

  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: {
        swapRequiresApproval: true,
      },
      select: { id: true },
    });
  }

  return settings;
}

export async function loadGoogleTokenFromDatabase(): Promise<GoogleTokenShape | null> {
  const settings = await prisma.systemSettings.findFirst({
    select: {
      googleTokenEncrypted: true,
    },
  });

  if (!settings?.googleTokenEncrypted) {
    return null;
  }

  try {
    return JSON.parse(decryptPayload(settings.googleTokenEncrypted)) as GoogleTokenShape;
  } catch (error) {
    console.error('Erro ao descriptografar token do Google salvo no banco:', error);
    return null;
  }
}

export async function saveGoogleTokenToDatabase(token: GoogleTokenShape): Promise<void> {
  const settings = await ensureSystemSettingsRow();

  await prisma.systemSettings.update({
    where: { id: settings.id },
    data: {
      googleTokenEncrypted: encryptPayload(JSON.stringify(token)),
      googleTokenUpdatedAt: new Date(),
    },
  });
}

export async function clearGoogleTokenFromDatabase(): Promise<void> {
  const settings = await prisma.systemSettings.findFirst({
    select: { id: true },
  });

  if (!settings) {
    return;
  }

  await prisma.systemSettings.update({
    where: { id: settings.id },
    data: {
      googleTokenEncrypted: null,
      googleTokenUpdatedAt: null,
    },
  });
}

export async function getGoogleTokenUpdatedAt(): Promise<Date | null> {
  const settings = await prisma.systemSettings.findFirst({
    select: {
      googleTokenUpdatedAt: true,
    },
  });

  return settings?.googleTokenUpdatedAt ?? null;
}
