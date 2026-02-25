import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, needsInitialSetup } from './src/lib/auth';

// Rotas que não precisam de autenticação
const publicRoutes = ['/login', '/setup'];

// Rotas que só admins podem acessar
const adminOnlyRoutes = [
  '/physiotherapists',
  '/teams',
  '/reports',
  '/staff'
];

// Rotas da API que não precisam de autenticação
const publicApiRoutes = ['/api/auth/login', '/api/auth/setup', '/api/auth/check-setup'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Permite acesso a arquivos estáticos e API routes públicas
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public') ||
    publicApiRoutes.some(route => pathname.startsWith(route))
  ) {
    return NextResponse.next();
  }

  // Obtém o token de autenticação
  const token = request.cookies.get('auth-token')?.value;
  const user = token ? verifyToken(token) : null;

  // Se não há usuário logado e não é uma rota pública
  if (!user && !publicRoutes.includes(pathname)) {
    // Verifica se precisa de setup inicial
    const needsSetup = await needsInitialSetup();
    
    if (needsSetup) {
      // Redireciona para setup se não há admins no sistema
      return NextResponse.redirect(new URL('/setup', request.url));
    } else {
      // Redireciona para login se já há admins no sistema
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Se há usuário logado e está tentando acessar login ou setup
  if (user && (pathname === '/login' || pathname === '/setup')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Verifica se o usuário precisa trocar a senha
  if (user && user.mustChangePassword && pathname !== '/change-password') {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  // Verifica acesso a rotas administrativas
  if (adminOnlyRoutes.some(route => pathname.startsWith(route))) {
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Verifica rotas da API que precisam de autenticação
  if (pathname.startsWith('/api/') && !publicApiRoutes.some(route => pathname.startsWith(route))) {
    if (!user) {
      return NextResponse.json(
        { error: 'Token de autenticação necessário' },
        { status: 401 }
      );
    }

    // Adiciona informações do usuário aos headers para as API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', user.id.toString());
    requestHeaders.set('x-user-role', user.role);
    requestHeaders.set('x-user-email', user.email);
    if (user.physiotherapistId) {
      requestHeaders.set('x-physiotherapist-id', user.physiotherapistId.toString());
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};