import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 12;

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  physiotherapistId?: number | null;
  isFirstLogin: boolean;
  mustChangePassword: boolean;
}

/**
 * Gera hash da senha usando bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifica se a senha fornecida corresponde ao hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Gera um JWT token para o usuário
 */
export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      physiotherapistId: user.physiotherapistId,
      isFirstLogin: user.isFirstLogin,
      mustChangePassword: user.mustChangePassword,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verifica e decodifica um JWT token
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      physiotherapistId: decoded.physiotherapistId,
      isFirstLogin: decoded.isFirstLogin,
      mustChangePassword: decoded.mustChangePassword,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Obtém o usuário atual a partir do cookie de autenticação
 */
export async function getCurrentUser(headersList?: any): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    console.log('Cookie token:', token ? 'EXISTS' : 'NOT FOUND');
    
    if (!token) {
      console.log('No auth token found in cookies');
      return null;
    }

    const user = verifyToken(token);
    console.log('Token verification:', user ? 'VALID' : 'INVALID');
    if (!user) {
      return null;
    }

    // Verifica se o usuário ainda existe no banco
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { physiotherapist: true }
    });

    if (!dbUser) {
      return null;
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      physiotherapistId: dbUser.physiotherapistId,
      isFirstLogin: dbUser.isFirstLogin,
      mustChangePassword: dbUser.mustChangePassword,
    };
  } catch (error) {
    console.error('Erro ao obter usuário atual:', error);
    return null;
  }
}

/**
 * Verifica se o sistema precisa de configuração inicial (não há usuários admin)
 */
export async function needsInitialSetup(): Promise<boolean> {
  try {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    });
    return adminCount === 0;
  } catch (error: any) {
    console.error('Erro ao verificar setup inicial:', error);
    
    // Se for erro de tabela não existir (P2021), retorna true para indicar que precisa de setup
    if (error.code === 'P2021') {
      console.log('⚠️ Tabelas não existem. Setup inicial necessário.');
      return true;
    }
    
    // Se for erro de conectividade (P1001), também retorna true
    if (error.code === 'P1001') {
      console.log('⚠️ Erro de conectividade com banco. Setup inicial será necessário quando conectar.');
      return true;
    }
    
    // Para outros erros, relança
    throw error;
  }
}

/**
 * Autentica um usuário com email e senha
 */
export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  try {
    console.log('🔐 Tentativa de autenticação:', { email });
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: { physiotherapist: true }
    });

    if (!user) {
      console.log('❌ Usuário não encontrado:', email);
      return null;
    }

    console.log('✅ Usuário encontrado:', user.name);
    console.log('🔑 Verificando senha...');
    
    const isValidPassword = await verifyPassword(password, user.password);
    
    console.log('🔑 Senha válida?', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Senha inválida');
      return null;
    }
    
    console.log('✅ Autenticação bem-sucedida!');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      physiotherapistId: user.physiotherapistId,
      isFirstLogin: user.isFirstLogin,
      mustChangePassword: user.mustChangePassword,
    };
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return null;
  }
}

/**
 * Gera uma senha padrão para novos usuários
 */
export function generateDefaultPassword(): string {
  return Math.random().toString(36).slice(-8);
}

/**
 * Verifica se o usuário tem permissão para acessar uma funcionalidade
 */
export function hasPermission(user: AuthUser | null, requiredRole: UserRole): boolean {
  if (!user) return false;
  
  // Admin tem acesso a tudo
  if (user.role === 'ADMIN') return true;
  
  // Verifica se o role do usuário corresponde ao requerido
  return user.role === requiredRole;
}

/**
 * Verifica se o usuário é admin
 */
export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'ADMIN';
}

/**
 * Verifica se o usuário pode acessar dados de um fisioterapeuta específico
 */
export function canAccessPhysiotherapist(user: AuthUser | null, physiotherapistId: number): boolean {
  if (!user) return false;
  
  // Admin pode acessar qualquer fisioterapeuta
  if (user.role === 'ADMIN') return true;
  
  // Usuário comum só pode acessar seus próprios dados
  return user.physiotherapistId === physiotherapistId;
}