import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth-helpers';
import { getGoogleAuthStatus } from '@/lib/google-drive';

/**
 * GET /api/auth/google
 * Retorna o status atual da integracao e a URL de autenticacao/reautenticacao.
 */
export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const status = await getGoogleAuthStatus('/maintenance?tab=backup');

    return NextResponse.json(status);
  } catch (error) {
    console.error('Erro ao verificar autenticacao do Google:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar autenticacao do Google.' },
      { status: 500 }
    );
  }
}
