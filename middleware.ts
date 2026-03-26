import { NextResponse } from 'next/server';
import type { NextAuthRequest } from 'next-auth';
import { auth } from './src/auth';
import { needsInitialSetup } from './src/lib/auth';

// Rotas públicas da aplicação
const publicPageRoutes = ['/login', '/setup'];

// Rotas exclusivas de administradores
const adminOnlyRoutes = [
  '/reports',
  '/users',
  '/contracts',
  '/payments',
  '/payment-control',
  '/settings',
  '/maintenance',
  '/admin',
];

// Rotas disponíveis para administradores e gestores
const managerAllowedRoutes = [
  '/physiotherapists',
  '/teams',
  '/holidays',
  '/shift-deletion-history',
];

function isPublicPage(pathname: string) {
  return publicPageRoutes.includes(pathname);
}

function isAdminOnlyRoute(pathname: string) {
  return adminOnlyRoutes.some(route => pathname.startsWith(route));
}

function isManagerAllowedRoute(pathname: string) {
  return managerAllowedRoutes.some(route => pathname.startsWith(route));
}

function isPublicAuthRoute(pathname: string) {
  return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

export default auth(async function middleware(request: NextAuthRequest) {
  const { pathname } = request.nextUrl;
  const sessionUser = request.auth?.user;

  // Mantém os endpoints internos do NextAuth e nossas rotas de auth fora do bloqueio do middleware
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public') ||
    isPublicAuthRoute(pathname)
  ) {
    return NextResponse.next();
  }

  // Se não há sessão e não é rota pública, decide entre setup e login
  if (!sessionUser && !isPublicPage(pathname)) {
    const needsSetup = await needsInitialSetup();

    if (needsSetup) {
      return NextResponse.redirect(new URL('/setup', request.url));
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Usuário autenticado não deve voltar para login ou setup
  if (sessionUser && isPublicPage(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Força troca de senha quando necessário
  if (sessionUser && sessionUser.mustChangePassword && pathname !== '/change-password') {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  // Controle de acesso para rotas administrativas
  if (isAdminOnlyRoute(pathname)) {
    if (!sessionUser || sessionUser.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  if (isManagerAllowedRoute(pathname)) {
    if (!sessionUser || (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'MANAGER')) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Protege as demais rotas de API
  if (pathname.startsWith('/api/')) {
    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Autenticação necessária' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
