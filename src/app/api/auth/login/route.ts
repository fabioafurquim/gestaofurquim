import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateUser, generateToken } from '@/lib/auth';
import { cookies } from 'next/headers';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

/**
 * POST /api/auth/login
 * Autentica um usuário e retorna um token JWT
 */
export async function POST(request: NextRequest) {
  try {
    console.log('=== LOGIN REQUEST RECEIVED ===');
    const body = await request.json();
    console.log('Body received:', { email: body.email, hasPassword: !!body.password });
    
    const validatedData = loginSchema.parse(body);
    console.log('Data validated successfully');

    // Autentica o usuário
    const user = await authenticateUser(validatedData.email, validatedData.password);
    console.log('Authentication result:', user ? 'SUCCESS' : 'FAILED');

    if (!user) {
      console.log('Login failed: Invalid credentials');
      return NextResponse.json(
        { error: 'Email ou senha inválidos' },
        { status: 401 }
      );
    }

    // Gera o token de autenticação
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      physiotherapistId: user.physiotherapistId,
      isFirstLogin: user.isFirstLogin,
      mustChangePassword: user.mustChangePassword,
    });

    // Define o cookie de autenticação
    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });
    
    console.log('Cookie set successfully');

    return NextResponse.json({
      message: 'Login realizado com sucesso',
      token, // Retornando token no body também
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