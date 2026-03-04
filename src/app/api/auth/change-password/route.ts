import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { auth } from '@/auth';

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
    console.log('🔐 Iniciando troca de senha...');
    const session = await auth();

    if (!session?.user) {
      console.log('❌ Sessão não encontrada');
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    console.log('✅ Sessão encontrada:', session.user.email);

    const body = await request.json();
    console.log('📝 Dados recebidos (sem senhas):', { email: session.user.email });
    
    const validatedData = changePasswordSchema.parse(body);
    console.log('✅ Validação OK');

    // Busca o usuário completo com a senha
    const userId = typeof session.user.id === 'string' ? parseInt(session.user.id) : session.user.id;
    console.log('🔍 Buscando usuário no banco, ID:', userId, 'Tipo:', typeof userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    console.log('✅ Usuário encontrado:', user ? 'SIM' : 'NÃO');

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
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        isFirstLogin: false,
        mustChangePassword: false,
      },
    });

    // NextAuth gerencia a sessão automaticamente, não precisa gerar token manualmente
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