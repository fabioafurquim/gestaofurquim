import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateDefaultPassword, getCurrentUser, isAdmin } from '@/lib/auth';
import { headers } from 'next/headers';

const updateUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  email: z.string().email('Email inválido').optional(),
  role: z.enum(['ADMIN', 'USER'], { errorMap: () => ({ message: 'Role deve ser ADMIN ou USER' }) }).optional(),
  physiotherapistId: z.coerce.number().nullable().optional(),
});

/**
 * GET /api/users/[id]
 * Obtém um usuário específico
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const currentUser = await getCurrentUser(headersList);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
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

    // Administradores podem ver qualquer usuário, usuários comuns só podem ver a si mesmos
    if (!isAdmin(currentUser) && currentUser.id !== userId) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        physiotherapistId: true,
        isFirstLogin: true,
        mustChangePassword: true,
        createdAt: true,
        physiotherapist: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: true,
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/[id]
 * Atualiza um usuário (apenas para administradores)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const currentUser = await getCurrentUser(headersList);

    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem atualizar usuários.' },
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

    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Verifica se o usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verifica se o email já está em uso por outro usuário
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailInUse = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });

      if (emailInUse) {
        return NextResponse.json(
          { error: 'Este email já está em uso por outro usuário' },
          { status: 400 }
        );
      }
    }

    // Se o role for USER, deve ter um physiotherapistId
    if (validatedData.role === 'USER' && !validatedData.physiotherapistId && !existingUser.physiotherapistId) {
      return NextResponse.json(
        { error: 'Usuários comuns devem estar associados a um fisioterapeuta' },
        { status: 400 }
      );
    }

    // Verifica se o fisioterapeuta existe (se fornecido)
    if (validatedData.physiotherapistId) {
      const physiotherapist = await prisma.physiotherapist.findUnique({
        where: { id: validatedData.physiotherapistId }
      });

      if (!physiotherapist) {
        return NextResponse.json(
          { error: 'Fisioterapeuta não encontrado' },
          { status: 400 }
        );
      }

      // Verifica se o fisioterapeuta já tem outro usuário associado
      const existingUserForPhysiotherapist = await prisma.user.findFirst({
        where: {
          physiotherapistId: validatedData.physiotherapistId,
          id: { not: userId }
        }
      });

      if (existingUserForPhysiotherapist) {
        return NextResponse.json(
          { error: 'Este fisioterapeuta já possui outro usuário associado' },
          { status: 400 }
        );
      }
    }

    // Atualiza o usuário
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        physiotherapistId: true,
        isFirstLogin: true,
        mustChangePassword: true,
        createdAt: true,
        physiotherapist: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Usuário atualizado com sucesso',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    
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

/**
 * DELETE /api/users/[id]
 * Remove um usuário (apenas para administradores)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const currentUser = await getCurrentUser(headersList);

    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem remover usuários.' },
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

    // Não permite que o usuário delete a si mesmo
    if (currentUser.id === userId) {
      return NextResponse.json(
        { error: 'Você não pode deletar sua própria conta' },
        { status: 400 }
      );
    }

    // Verifica se o usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Remove o usuário
    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({
      message: 'Usuário removido com sucesso'
    });
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}