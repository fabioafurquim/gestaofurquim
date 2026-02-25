import { NextResponse } from 'next/server';
import { getAuthUrl, isAuthenticated } from '@/lib/google-drive';

/**
 * GET /api/auth/google
 * Retorna a URL de autenticação do Google ou status de autenticação
 */
export async function GET() {
  try {
    const authenticated = isAuthenticated();
    
    if (authenticated) {
      return NextResponse.json({
        authenticated: true,
        message: 'Google já está autenticado',
      });
    }

    const authUrl = getAuthUrl();
    
    return NextResponse.json({
      authenticated: false,
      authUrl,
      message: 'Acesse a URL para autenticar com o Google',
    });
  } catch (error) {
    console.error('Erro ao gerar URL de autenticação:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar URL de autenticação' },
      { status: 500 }
    );
  }
}
