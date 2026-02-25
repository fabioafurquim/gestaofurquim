import { auth } from '@/auth';
import { NextResponse } from 'next/server';

/**
 * Helper para obter usuário autenticado via NextAuth nas rotas de API
 */
export async function getAuthenticatedUser() {
  const session = await auth();
  
  if (!session || !session.user) {
    return null;
  }
  
  return session.user;
}

/**
 * Helper para verificar autenticação e retornar erro 401 se não autenticado
 */
export async function requireAuth() {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Acesso negado. Usuário não autenticado.' },
        { status: 401 }
      ),
      user: null
    };
  }
  
  return { error: null, user };
}

/**
 * Helper para verificar se usuário é admin
 */
export async function requireAdmin() {
  const { error, user } = await requireAuth();
  
  if (error) {
    return { error, user: null };
  }
  
  if (user!.role !== 'ADMIN') {
    return {
      error: NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      ),
      user: null
    };
  }
  
  return { error: null, user };
}
