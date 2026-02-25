import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, verifyToken } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/auth/me
 * Retorna informações do usuário atual autenticado
 */
export async function GET(request: NextRequest) {
  try {
    console.log('=== /api/auth/me REQUEST ===');
    
    // Tenta pegar o token do header Authorization primeiro
    const authHeader = request.headers.get('authorization');
    let currentUser = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log('Token from Authorization header:', token ? 'EXISTS' : 'NOT FOUND');
      const decoded = verifyToken(token);
      
      if (decoded) {
        const dbUser = await prisma.user.findUnique({
          where: { id: decoded.id },
          include: { physiotherapist: true }
        });
        
        if (dbUser) {
          currentUser = {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role,
            physiotherapistId: dbUser.physiotherapistId,
            isFirstLogin: dbUser.isFirstLogin,
            mustChangePassword: dbUser.mustChangePassword,
          };
        }
      }
    }
    
    // Se não encontrou no header, tenta pegar do cookie
    if (!currentUser) {
      const headersList = await headers();
      currentUser = await getCurrentUser(headersList);
    }
    
    console.log('Current user:', currentUser ? 'FOUND' : 'NOT FOUND');

    if (!currentUser) {
      console.log('User not authenticated - returning 401');
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        physiotherapistId: currentUser.physiotherapistId,
        isFirstLogin: currentUser.isFirstLogin,
        mustChangePassword: currentUser.mustChangePassword,
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