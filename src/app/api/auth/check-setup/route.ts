import { NextResponse } from 'next/server';
import { needsInitialSetup } from '@/lib/auth';

/**
 * GET /api/auth/check-setup
 * Verifica se o sistema precisa de configuração inicial
 */
export async function GET() {
  try {
    const needsSetup = await needsInitialSetup();
    
    return NextResponse.json({ needsSetup });
  } catch (error) {
    console.error('Erro ao verificar setup inicial:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}