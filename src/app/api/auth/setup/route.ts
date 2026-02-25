import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { execSync } from 'child_process';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateToken, needsInitialSetup } from '@/lib/auth';
import { cookies } from 'next/headers';

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
 * Executa migrações do Prisma se necessário
 */
async function ensureMigrations(): Promise<void> {
  try {
    console.log('🔄 Executando migrações do Prisma...');
    
    // Executa as migrações
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    // Gera o cliente Prisma
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    console.log('✅ Migrações executadas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao executar migrações:', error);
    throw error;
  }
}

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

    // Tenta verificar se já existe um usuário com este email
    // Se falhar com P2021, executa migrações primeiro
    let existingUser;
    try {
      existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });
    } catch (error: any) {
      if (error.code === 'P2021') {
        console.log('🔄 Tabelas não existem. Executando migrações...');
        await ensureMigrations();
        
        // Tenta novamente após as migrações
        existingUser = await prisma.user.findUnique({
          where: { email: validatedData.email }
        });
      } else {
        throw error;
      }
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });

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