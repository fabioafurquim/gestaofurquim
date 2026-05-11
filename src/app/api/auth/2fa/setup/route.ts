import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { buildTwoFactorSetup, TwoFactorError } from '@/lib/two-factor';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const userId =
      typeof session.user.id === 'string' ? parseInt(session.user.id, 10) : session.user.id;
    const setup = await buildTwoFactorSetup(userId);

    return NextResponse.json(setup);
  } catch (error) {
    if (error instanceof TwoFactorError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Erro ao preparar 2FA:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
