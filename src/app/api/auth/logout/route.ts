import { NextResponse } from 'next/server';
import { signOut } from '@/auth';

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

    return NextResponse.json({
      message: 'Logout realizado com sucesso',
      redirectTo: '/login',
    });
  } catch (error) {
    console.error('Erro no logout:', error);

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
