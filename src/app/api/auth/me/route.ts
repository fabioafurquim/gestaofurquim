import { NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * GET /api/auth/me
 * Retorna a sessão atual do NextAuth
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        physiotherapistId: session.user.physiotherapistId,
        isFirstLogin: session.user.isFirstLogin,
        mustChangePassword: session.user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error('Erro ao obter usuário atual:', error);

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
