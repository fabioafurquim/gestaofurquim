import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/auth';
import { clearTwoFactorCookies, disableTwoFactor, TwoFactorError } from '@/lib/two-factor';

const disableSchema = z.object({
  code: z.string().min(4, 'Informe um código do autenticador ou um código de recuperação.'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = disableSchema.parse(body);
    const userId =
      typeof session.user.id === 'string' ? parseInt(session.user.id, 10) : session.user.id;

    await disableTwoFactor(userId, validatedData.code);

    const response = NextResponse.json({
      message: 'Autenticação em duas etapas redefinida. Configure novamente para continuar protegido.',
    });

    clearTwoFactorCookies(response, { clearTrustedDevice: true });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? 'Dados inválidos.' }, { status: 400 });
    }

    if (error instanceof TwoFactorError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Erro ao redefinir 2FA:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
