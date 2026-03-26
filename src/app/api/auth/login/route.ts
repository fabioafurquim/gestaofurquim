import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { signIn } from '@/auth';
import { authenticateUser } from '@/lib/auth';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

/**
 * POST /api/auth/login
 * Autentica um usuário usando o fluxo do NextAuth
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    const user = await authenticateUser(validatedData.email, validatedData.password);

    if (!user) {
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      );
    }

    await signIn('credentials', {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
      redirectTo: '/',
    });

    return NextResponse.json({
      message: 'Login realizado com sucesso',
      redirectTo: '/',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        physiotherapistId: user.physiotherapistId,
        isFirstLogin: user.isFirstLogin,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error('Erro no login:', error);

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
