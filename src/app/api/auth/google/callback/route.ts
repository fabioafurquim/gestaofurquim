import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/google-drive';

/**
 * GET /api/auth/google/callback
 * Callback de autenticação do Google OAuth
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/payment-control?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/payment-control?error=Código de autorização não fornecido', request.url)
      );
    }

    await exchangeCodeForTokens(code);

    return NextResponse.redirect(
      new URL('/payment-control?success=Google autenticado com sucesso', request.url)
    );
  } catch (error) {
    console.error('Erro no callback do Google:', error);
    return NextResponse.redirect(
      new URL(`/payment-control?error=${encodeURIComponent('Erro ao autenticar com o Google')}`, request.url)
    );
  }
}
