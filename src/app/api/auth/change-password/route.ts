import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword, getCurrentUser, generateToken } from '@/lib/auth';
import { headers, cookies } from 'next/headers';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

/**
 * POST /api/auth/change-password
 * Permite que o usuário altere sua própria senha
 */
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const currentUser = await getCurrentUser(headersList);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = changePasswordSchema.parse(body);

    // Busca o usuário completo com a senha
    const user = await prisma.user.findUnique({
      where: { id: currentUser.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verifica se a senha atual está correta
    const isCurrentPasswordValid = await verifyPassword(
      validatedData.currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Senha atual incorreta' },
        { status: 400 }
      );
    }

    // Cria o hash da nova senha
    const hashedNewPassword = await hashPassword(validatedData.newPassword);

    // Atualiza a senha e remove as flags de primeira entrada
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        password: hashedNewPassword,
        isFirstLogin: false,
        mustChangePassword: false,
      },
    });

    // Gera um novo token com as informações atualizadas
    const newToken = generateToken({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      physiotherapistId: updatedUser.physiotherapistId,
      isFirstLogin: updatedUser.isFirstLogin,
      mustChangePassword: updatedUser.mustChangePassword,
    });

    // Atualiza o cookie de autenticação
    const cookieStore = await cookies();
    cookieStore.set('auth-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });

    return NextResponse.json({
      message: 'Senha alterada com sucesso',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        physiotherapistId: updatedUser.physiotherapistId,
        isFirstLogin: updatedUser.isFirstLogin,
        mustChangePassword: updatedUser.mustChangePassword,
      },
    });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}