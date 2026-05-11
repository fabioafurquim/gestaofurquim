import { NextResponse } from 'next/server';
import { signOut } from '@/auth';
import { clearTwoFactorCookies } from '@/lib/two-factor';

/**
 * POST /api/auth/logout
 * Encerra a sessão gerenciada pelo NextAuth
 */
export async function POST() {
  try {
    await signOut({
      redirect: false,
      redirectTo: '/login',
    });

    const response = NextResponse.json({
      message: 'Logout realizado com sucesso',
      redirectTo: '/login',
    });

    clearTwoFactorCookies(response);

    return response;
  } catch (error) {
    console.error('Erro no logout:', error);

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
