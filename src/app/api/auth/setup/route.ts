import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { signIn } from '@/auth';
import { hashPassword, needsInitialSetup } from '@/lib/auth';

const setupSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

/**
 * POST /api/auth/setup
 * Cria o primeiro usuário administrador do sistema
 */
export async function POST(request: NextRequest) {
  try {
    // Verifica se o sistema ainda precisa de configuração
    const needsSetup = await needsInitialSetup();
    
    // Se não precisa de setup, retorna
    if (!needsSetup) {
      return NextResponse.json(
        { error: 'Sistema já foi configurado' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = setupSchema.parse(body);

    let existingUser;
    try {
      existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });
    } catch (error: any) {
      if (error.code === 'P2021') {
        return NextResponse.json(
          {
            error: 'Banco de dados ainda não inicializado. Execute as migrations do Prisma antes do setup inicial.',
          },
          { status: 503 }
        );
      }

      throw error;
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'Já existe um usuário com este email' },
        { status: 400 }
      );
    }

    // Cria o hash da senha
    const hashedPassword = await hashPassword(validatedData.password);

    // Cria o primeiro usuário administrador
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: 'ADMIN',
        isFirstLogin: false,
        mustChangePassword: false,
      },
    });

    try {
      // Cria a sessão do NextAuth para o administrador recém-criado
      await signIn('credentials', {
        email: validatedData.email,
        password: validatedData.password,
        redirect: false,
        redirectTo: '/',
      });
    } catch (signInError) {
      console.error('Falha ao autenticar automaticamente o administrador:', signInError);
    }

    return NextResponse.json({
      message: 'Administrador criado com sucesso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Erro no setup inicial:', error);
    
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
