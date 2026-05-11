import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/auth';
import {
  applyTwoFactorCookies,
  createTrustedDevice,
  enableTwoFactor,
  extractIpAddressFromHeaders,
  TwoFactorError,
} from '@/lib/two-factor';

const enableSchema = z.object({
  code: z.string().min(6, 'Informe o código do autenticador.'),
  trustDevice: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = enableSchema.parse(body);
    const userId =
      typeof session.user.id === 'string' ? parseInt(session.user.id, 10) : session.user.id;
    const result = await enableTwoFactor(userId, validatedData.code);
    const trustedDeviceCookie = validatedData.trustDevice
      ? await createTrustedDevice(userId, {
          ipAddress: extractIpAddressFromHeaders(request.headers),
          userAgent: request.headers.get('user-agent'),
        })
      : null;
    const response = NextResponse.json({
      message: 'Autenticação em duas etapas habilitada com sucesso.',
      recoveryCodes: result.recoveryCodes,
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

    console.error('Erro ao habilitar 2FA:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
