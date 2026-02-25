import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateDefaultPassword, getCurrentUser, isAdmin } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * POST /api/users/[id]/reset-password
 * Reseta a senha de um usuário (apenas para administradores)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const currentUser = await getCurrentUser(headersList);

    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem resetar senhas.' },
        { status: 403 }
      );
    }

    // Converte o id para inteiro
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID de usuário inválido' },
        { status: 400 }
      );
    }

    // Verifica se o usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Gera uma nova senha padrão
    const newPassword = generateDefaultPassword();
    const hashedPassword = await hashPassword(newPassword);

    // Atualiza a senha do usuário e marca para trocar na próxima entrada
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
        isFirstLogin: false, // Não é mais primeiro login, mas deve trocar a senha
      },
    });

    return NextResponse.json({
      message: 'Senha resetada com sucesso',
      newPassword, // Retorna a nova senha para o administrador informar ao usuário
      user: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
      },
    });
  } catch (error) {
    console.error('Erro ao resetar senha:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}