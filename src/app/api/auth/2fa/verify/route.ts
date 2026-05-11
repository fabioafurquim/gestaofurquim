import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/auth';
import {
  applyTwoFactorCookies,
  createTrustedDevice,
  extractIpAddressFromHeaders,
  getTwoFactorStatus,
  getTwoFactorCookieNames,
  TwoFactorError,
  verifyTwoFactorCode,
} from '@/lib/two-factor';

const verifySchema = z.object({
  code: z.string().min(4, 'Informe o código do autenticador ou um código de recuperação.'),
  trustDevice: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const userId =
      typeof session.user.id === 'string' ? parseInt(session.user.id, 10) : session.user.id;
    const cookieNames = getTwoFactorCookieNames();
    const status = await getTwoFactorStatus(
      userId,
      request.cookies.get(cookieNames.verified)?.value,
      request.cookies.get(cookieNames.trustedDevice)?.value,
    );

    if (!status.enabled) {
      return NextResponse.json({ error: 'A autenticação em duas etapas ainda não foi configurada.' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = verifySchema.parse(body);
    const verification = await verifyTwoFactorCode(userId, validatedData.code);

    if (!verification.valid) {
      throw new TwoFactorError('Código inválido. Confira o aplicativo autenticador ou use um código de recuperação válido.');
    }

    const trustedDeviceCookie = validatedData.trustDevice
      ? await createTrustedDevice(userId, {
          ipAddress: extractIpAddressFromHeaders(request.headers),
          userAgent: request.headers.get('user-agent'),
        })
      : null;
    const response = NextResponse.json({
      message: verification.usedRecoveryCode
        ? 'Código de recuperação aceito. Guarde os códigos restantes com cuidado.'
        : 'Verificação concluída com sucesso.',
      usedRecoveryCode: verification.usedRecoveryCode,
      recoveryCodesRemaining: verification.recoveryCodesRemaining,
    });

    applyTwoFactorCookies(response, userId, trustedDeviceCookie);

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? 'Dados inválidos.' }, { status: 400 });
    }

    if (error instanceof TwoFactorError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Erro ao verificar 2FA:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
