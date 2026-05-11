import crypto from 'crypto';

import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';

import { prisma } from '@/lib/prisma';

const TWO_FACTOR_ENCRYPTION_VERSION = 'v1';
const TWO_FACTOR_VERIFIED_COOKIE_NAME = 'furquim_2fa_verified';
const TWO_FACTOR_TRUSTED_DEVICE_COOKIE_NAME = 'furquim_trusted_device';
const TWO_FACTOR_ISSUER = 'Gestao Furquim';
const TRUSTED_DEVICE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const VERIFIED_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const RECOVERY_CODES_COUNT = 8;

export type TwoFactorRole = 'ADMIN' | 'MANAGER' | 'USER';

type VerifiedCookiePayload = {
  userId: number;
  expiresAt: number;
};

type TwoFactorUserRecord = {
  id: number;
  email: string;
  role: TwoFactorRole;
  twoFactorEnabled: boolean;
  twoFactorSecretEncrypted: string | null;
  twoFactorRecoveryCodeHashes: string[];
  twoFactorEnabledAt: Date | null;
};

export class TwoFactorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TwoFactorError';
  }
}

function getTwoFactorSecretKey() {
  const secret =
    process.env.TWO_FACTOR_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CRON_SECRET;

  if (!secret) {
    throw new TwoFactorError('Nenhum segredo configurado para criptografar os dados de autenticação em duas etapas.');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

function encryptValue(payload: string) {
  const key = getTwoFactorSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${TWO_FACTOR_ENCRYPTION_VERSION}:${Buffer.concat([iv, authTag, encrypted]).toString('base64')}`;
}

function decryptValue(encryptedValue: string) {
  const [version, encodedPayload] = encryptedValue.split(':', 2);

  if (version !== TWO_FACTOR_ENCRYPTION_VERSION || !encodedPayload) {
    throw new TwoFactorError('Formato de dados criptografados do 2FA é inválido.');
  }

  const payload = Buffer.from(encodedPayload, 'base64');
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const key = getTwoFactorSecretKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function getSignatureSecret() {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CRON_SECRET;

  if (!secret) {
    throw new TwoFactorError('Nenhum segredo configurado para assinar os cookies do 2FA.');
  }

  return secret;
}

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: string) {
  return crypto.createHmac('sha256', getSignatureSecret()).update(payload).digest('base64url');
}

function normalizeRecoveryCode(code: string) {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function hashRecoveryCode(code: string) {
  return crypto.createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

function hashTrustedDeviceToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildTrustedDeviceCookieValue(deviceId: number, token: string) {
  return `${deviceId}.${token}`;
}

function parseTrustedDeviceCookieValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const [deviceIdRaw, token] = value.split('.', 2);
  const deviceId = Number(deviceIdRaw);

  if (!Number.isInteger(deviceId) || !token) {
    return null;
  }

  return { deviceId, token };
}

function createVerifiedCookieValue(payload: VerifiedCookiePayload) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function parseVerifiedCookieValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split('.', 2);

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    return JSON.parse(fromBase64Url(encodedPayload)) as VerifiedCookiePayload;
  } catch {
    return null;
  }
}

function generateRecoveryCode() {
  const raw = crypto.randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const normalized = raw.slice(0, 8).padEnd(8, 'X');

  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
}

function createRecoveryCodes() {
  const codes = Array.from({ length: RECOVERY_CODES_COUNT }, generateRecoveryCode);
  const hashes = codes.map(hashRecoveryCode);

  return {
    codes,
    hashes,
  };
}

function describeDevice(userAgent?: string | null) {
  if (!userAgent) {
    return 'Dispositivo confiável';
  }

  const source = userAgent.toLowerCase();

  if (source.includes('iphone')) {
    return 'iPhone';
  }

  if (source.includes('ipad')) {
    return 'iPad';
  }

  if (source.includes('android')) {
    return 'Android';
  }

  if (source.includes('windows')) {
    return 'Windows';
  }

  if (source.includes('mac os')) {
    return 'macOS';
  }

  if (source.includes('linux')) {
    return 'Linux';
  }

  return 'Dispositivo confiável';
}

async function getTwoFactorUser(userId: number): Promise<TwoFactorUserRecord> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      twoFactorEnabled: true,
      twoFactorSecretEncrypted: true,
      twoFactorRecoveryCodeHashes: true,
      twoFactorEnabledAt: true,
    },
  });

  if (!user) {
    throw new TwoFactorError('Usuário não encontrado.');
  }

  return user;
}

function getStoredSecret(user: Pick<TwoFactorUserRecord, 'twoFactorSecretEncrypted'>) {
  if (!user.twoFactorSecretEncrypted) {
    return null;
  }

  return decryptValue(user.twoFactorSecretEncrypted);
}

export function roleRequiresTwoFactor(role?: string | null) {
  return role === 'ADMIN' || role === 'MANAGER';
}

export function getTwoFactorCookieNames() {
  return {
    verified: TWO_FACTOR_VERIFIED_COOKIE_NAME,
    trustedDevice: TWO_FACTOR_TRUSTED_DEVICE_COOKIE_NAME,
  };
}

export function extractIpAddressFromHeaders(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }

  return realIp?.trim() || null;
}

export async function buildTwoFactorSetup(userId: number) {
  const user = await getTwoFactorUser(userId);

  if (!roleRequiresTwoFactor(user.role)) {
    throw new TwoFactorError('Este tipo de usuário não exige autenticação em duas etapas.');
  }

  if (user.twoFactorEnabled && user.twoFactorSecretEncrypted) {
    throw new TwoFactorError('A autenticação em duas etapas já está habilitada para este usuário.');
  }

  const secret = getStoredSecret(user) ?? generateSecret();

  if (!user.twoFactorSecretEncrypted) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecretEncrypted: encryptValue(secret),
        twoFactorRecoveryCodeHashes: [],
        twoFactorEnabled: false,
        twoFactorEnabledAt: null,
      },
    });
  }

  const otpAuthUrl = generateURI({
    issuer: TWO_FACTOR_ISSUER,
    label: user.email,
    secret,
    period: 30,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, {
    margin: 1,
    width: 240,
  });

  return {
    secret,
    otpAuthUrl,
    qrCodeDataUrl,
  };
}

export async function getTwoFactorStatus(userId: number, verifiedCookieValue?: string | null, trustedDeviceCookieValue?: string | null) {
  const user = await getTwoFactorUser(userId);
  const required = roleRequiresTwoFactor(user.role);
  const verified = await isTwoFactorSatisfied(userId, verifiedCookieValue, trustedDeviceCookieValue);

  return {
    required,
    enabled: user.twoFactorEnabled,
    enabledAt: user.twoFactorEnabledAt,
    verified,
    requiresSetup: required && !user.twoFactorEnabled,
    requiresVerification: required && user.twoFactorEnabled && !verified,
    recoveryCodesRemaining: user.twoFactorRecoveryCodeHashes.length,
  };
}

export async function enableTwoFactor(userId: number, code: string) {
  const user = await getTwoFactorUser(userId);

  if (!roleRequiresTwoFactor(user.role)) {
    throw new TwoFactorError('Este tipo de usuário não exige autenticação em duas etapas.');
  }

  const secret = getStoredSecret(user);

  if (!secret) {
    throw new TwoFactorError('Nenhuma configuração pendente de 2FA foi encontrada. Gere um novo QR Code e tente novamente.');
  }

  const normalizedCode = code.replace(/\s+/g, '');
  const verification = verifySync({
    secret,
    token: normalizedCode,
    epochTolerance: 30,
  });
  const isValid = verification.valid;

  if (!isValid) {
    throw new TwoFactorError('Código inválido. Confira o aplicativo autenticador e tente novamente.');
  }

  const recovery = createRecoveryCodes();

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorRecoveryCodeHashes: recovery.hashes,
      twoFactorEnabledAt: new Date(),
    },
  });

  return {
    recoveryCodes: recovery.codes,
  };
}

export async function disableTwoFactor(userId: number, code: string) {
  const verification = await verifyTwoFactorCode(userId, code);

  if (!verification.valid) {
    throw new TwoFactorError('Código inválido. Informe um código do autenticador ou um código de recuperação válido.');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecretEncrypted: null,
        twoFactorRecoveryCodeHashes: [],
        twoFactorEnabledAt: null,
      },
    }),
    prisma.trustedTwoFactorDevice.deleteMany({
      where: { userId },
    }),
  ]);
}

export async function regenerateRecoveryCodes(userId: number, code: string) {
  const verification = await verifyTwoFactorCode(userId, code);

  if (!verification.valid) {
    throw new TwoFactorError('Código inválido. Informe um código do autenticador ou um código de recuperação válido.');
  }

  const recovery = createRecoveryCodes();

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorRecoveryCodeHashes: recovery.hashes,
    },
  });

  return recovery.codes;
}

export async function verifyTwoFactorCode(userId: number, code: string) {
  const user = await getTwoFactorUser(userId);

  if (!user.twoFactorEnabled) {
    return {
      valid: false,
      usedRecoveryCode: false,
      recoveryCodesRemaining: user.twoFactorRecoveryCodeHashes.length,
    };
  }

  const secret = getStoredSecret(user);
  const normalizedCode = code.trim();

  if (
    secret &&
    verifySync({
      secret,
      token: normalizedCode.replace(/\s+/g, ''),
      epochTolerance: 30,
    }).valid
  ) {
    return {
      valid: true,
      usedRecoveryCode: false,
      recoveryCodesRemaining: user.twoFactorRecoveryCodeHashes.length,
    };
  }

  const recoveryHash = hashRecoveryCode(normalizedCode);
  const recoveryIndex = user.twoFactorRecoveryCodeHashes.findIndex((item) => item === recoveryHash);

  if (recoveryIndex === -1) {
    return {
      valid: false,
      usedRecoveryCode: false,
      recoveryCodesRemaining: user.twoFactorRecoveryCodeHashes.length,
    };
  }

  const remainingRecoveryCodes = user.twoFactorRecoveryCodeHashes.filter((_, index) => index !== recoveryIndex);

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorRecoveryCodeHashes: remainingRecoveryCodes,
    },
  });

  return {
    valid: true,
    usedRecoveryCode: true,
    recoveryCodesRemaining: remainingRecoveryCodes.length,
  };
}

export function createTwoFactorVerifiedCookie(userId: number) {
  const expiresAt = Date.now() + VERIFIED_SESSION_MAX_AGE_SECONDS * 1000;

  return {
    name: TWO_FACTOR_VERIFIED_COOKIE_NAME,
    value: createVerifiedCookieValue({ userId, expiresAt }),
    maxAge: VERIFIED_SESSION_MAX_AGE_SECONDS,
  };
}

export function isTwoFactorVerifiedForUser(userId: number, cookieValue?: string | null) {
  const payload = parseVerifiedCookieValue(cookieValue);

  if (!payload) {
    return false;
  }

  return payload.userId === userId && payload.expiresAt > Date.now();
}

export async function createTrustedDevice(userId: number, options: { ipAddress?: string | null; userAgent?: string | null; label?: string | null }) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashTrustedDeviceToken(token);
  const device = await prisma.trustedTwoFactorDevice.create({
    data: {
      userId,
      tokenHash,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      label: options.label?.trim() || describeDevice(options.userAgent),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + TRUSTED_DEVICE_MAX_AGE_SECONDS * 1000),
    },
    select: {
      id: true,
    },
  });

  return {
    name: TWO_FACTOR_TRUSTED_DEVICE_COOKIE_NAME,
    value: buildTrustedDeviceCookieValue(device.id, token),
    maxAge: TRUSTED_DEVICE_MAX_AGE_SECONDS,
  };
}

export async function validateTrustedDevice(userId: number, cookieValue?: string | null) {
  const parsedCookie = parseTrustedDeviceCookieValue(cookieValue);

  if (!parsedCookie) {
    return null;
  }

  const device = await prisma.trustedTwoFactorDevice.findUnique({
    where: {
      id: parsedCookie.deviceId,
    },
    select: {
      id: true,
      userId: true,
      tokenHash: true,
      expiresAt: true,
    },
  });

  if (!device) {
    return null;
  }

  if (device.userId !== userId || device.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return device.tokenHash === hashTrustedDeviceToken(parsedCookie.token) ? device : null;
}

export async function touchTrustedDevice(deviceId: number) {
  await prisma.trustedTwoFactorDevice.update({
    where: { id: deviceId },
    data: {
      lastUsedAt: new Date(),
    },
  }).catch(() => null);
}

export async function isTwoFactorSatisfied(userId: number, verifiedCookieValue?: string | null, trustedDeviceCookieValue?: string | null) {
  if (isTwoFactorVerifiedForUser(userId, verifiedCookieValue)) {
    return true;
  }

  const trustedDevice = await validateTrustedDevice(userId, trustedDeviceCookieValue);

  if (!trustedDevice) {
    return false;
  }

  void touchTrustedDevice(trustedDevice.id);
  return true;
}

export async function listTrustedDevices(userId: number) {
  return prisma.trustedTwoFactorDevice.findMany({
    where: {
      userId,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      label: true,
      ipAddress: true,
      userAgent: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

export async function revokeTrustedDevice(userId: number, deviceId: number) {
  await prisma.trustedTwoFactorDevice.deleteMany({
    where: {
      id: deviceId,
      userId,
    },
  });
}

export async function revokeAllTrustedDevices(userId: number) {
  await prisma.trustedTwoFactorDevice.deleteMany({
    where: {
      userId,
    },
  });
}

export function clearTwoFactorCookies(response: import('next/server').NextResponse, options?: { clearTrustedDevice?: boolean }) {
  response.cookies.set(TWO_FACTOR_VERIFIED_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });

  if (options?.clearTrustedDevice) {
    response.cookies.set(TWO_FACTOR_TRUSTED_DEVICE_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(0),
    });
  }
}

export function applyTwoFactorCookies(
  response: import('next/server').NextResponse,
  userId: number,
  trustedDeviceCookie?: { name: string; value: string; maxAge: number } | null,
) {
  const verifiedCookie = createTwoFactorVerifiedCookie(userId);

  response.cookies.set(verifiedCookie.name, verifiedCookie.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: verifiedCookie.maxAge,
  });

  if (trustedDeviceCookie) {
    response.cookies.set(trustedDeviceCookie.name, trustedDeviceCookie.value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: trustedDeviceCookie.maxAge,
    });
  }
}
