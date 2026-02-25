import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateDefaultPassword, getCurrentUser, isAdmin } from '@/lib/auth';
import { headers } from 'next/headers';

const createUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  role: z.enum(['ADMIN', 'USER'], { errorMap: () => ({ message: 'Role deve ser ADMIN ou USER' }) }),
  physiotherapistId: z.union([
    z.string().transform((val) => parseInt(val, 10)),
    z.number(),
    z.undefined()
  ]).optional(),
});

/**
 * GET /api/users
 * Lista todos os usuários (apenas para administradores)
 */
export async function GET() {
  try {
    const headersList = await headers();
    const currentUser = await getCurrentUser(headersList);

    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem listar usuários.' },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Cria um novo usuário (apenas para administradores)
 */
export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const currentUser = await getCurrentUser(headersList);

    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem criar usuários.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Verifica se já existe um usuário com este email
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Já existe um usuário com este email' },
        { status: 400 }
      );
    }

    // Se o role for USER, deve ter um physiotherapistId
    if (validatedData.role === 'USER' && !validatedData.physiotherapistId) {
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

      // Verifica se o fisioterapeuta já tem um usuário associado
      const existingUserForPhysiotherapist = await prisma.user.findFirst({
        where: { physiotherapistId: validatedData.physiotherapistId }
      });

      if (existingUserForPhysiotherapist) {
        return NextResponse.json(
          { error: 'Este fisioterapeuta já possui um usuário associado' },
          { status: 400 }
        );
      }
    }

    // Gera uma senha padrão
    const defaultPassword = generateDefaultPassword();
    const hashedPassword = await hashPassword(defaultPassword);

    // Preparar dados para criação
    const createData: any = {
      name: validatedData.name,
      email: validatedData.email,
      password: hashedPassword,
      role: validatedData.role,
      isFirstLogin: true,
      mustChangePassword: true,
      createdBy: currentUser.id,
    };

    // Só adicionar physiotherapistId se não for undefined
    if (validatedData.physiotherapistId !== undefined) {
      createData.physiotherapistId = validatedData.physiotherapistId;
    }

    // Cria o usuário
    const user = await prisma.user.create({
      data: createData,
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
      message: 'Usuário criado com sucesso',
      user,
      defaultPassword, // Retorna a senha padrão para o administrador informar ao usuário
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    
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