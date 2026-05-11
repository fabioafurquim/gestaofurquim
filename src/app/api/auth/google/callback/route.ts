import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth-helpers';
import { exchangeCodeForTokens, getAuthReturnPathFromState } from '@/lib/google-drive';

function buildRedirectUrl(request: NextRequest, returnTo: string, params: Record<string, string>) {
  const url = new URL(returnTo, request.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

/**
 * GET /api/auth/google/callback
 * Finaliza a autenticacao do Google OAuth e persiste o token no banco.
 */
export async function GET(request: NextRequest) {
  const returnTo = getAuthReturnPathFromState(request.nextUrl.searchParams.get('state'));

  try {
    const { error: authError } = await requireAdmin();
    if (authError) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      return NextResponse.redirect(
        buildRedirectUrl(request, returnTo, {
          error: oauthError,
        })
      );
    }

    if (!code) {
      return NextResponse.redirect(
        buildRedirectUrl(request, returnTo, {
          error: 'Codigo de autorizacao nao fornecido.',
        })
      );
    }

    await exchangeCodeForTokens(code);

    return NextResponse.redirect(
      buildRedirectUrl(request, returnTo, {
        success: 'Google autenticado com sucesso.',
      })
    );
  } catch (error) {
    console.error('Erro no callback do Google:', error);

    return NextResponse.redirect(
      buildRedirectUrl(request, returnTo, {
        error: 'Erro ao autenticar com o Google.',
      })
    );
  }
}
