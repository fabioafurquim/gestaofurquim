import { NextResponse } from 'next/server';
import type { NextAuthRequest } from 'next-auth';

import { auth } from './src/auth';
import { needsInitialSetup } from './src/lib/auth';
import {
  getTwoFactorCookieNames,
  getTwoFactorStatus,
  roleRequiresTwoFactor,
} from './src/lib/two-factor';

const publicPageRoutes = ['/login', '/setup'];
const twoFactorPageRoutes = ['/two-factor/setup', '/two-factor/verify'];

const publicApiRoutes = [
  '/api/auth/login',
  '/api/auth/check-setup',
  '/api/auth/setup',
  '/api/auth/session',
  '/api/auth/csrf',
  '/api/auth/providers',
  '/api/auth/callback',
  '/api/auth/signin',
  '/api/auth/signout',
  '/api/auth/error',
  '/api/cron/database-backup',
  '/api/cron/notify-shifts',
  '/api/cron/webhook-health',
  '/api/telegram/webhook',
];

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

const adminOnlyApiRoutes = [
  '/api/users',
  '/api/contracts',
  '/api/payments',
  '/api/payment-control',
  '/api/reports',
  '/api/maintenance',
  '/api/access-logs',
  '/api/backup-logs',
  '/api/notifications',
  '/api/admin',
  '/api/system-settings',
];

const managerAllowedRoutes = [
  '/physiotherapists',
  '/teams',
  '/holidays',
  '/shift-deletion-history',
  '/financial-closing',
  '/security',
];

function isPublicPage(pathname: string) {
  return publicPageRoutes.includes(pathname);
}

function isTwoFactorPage(pathname: string) {
  return twoFactorPageRoutes.includes(pathname);
}

function isAdminOnlyRoute(pathname: string) {
  return adminOnlyRoutes.some((route) => pathname.startsWith(route));
}

function isManagerAllowedRoute(pathname: string) {
  return managerAllowedRoutes.some((route) => pathname.startsWith(route));
}

function isPublicAuthRoute(pathname: string) {
  return publicApiRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isAdminOnlyApiRoute(pathname: string) {
  return adminOnlyApiRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isTwoFactorApiRoute(pathname: string) {
  return (
    pathname === '/api/auth/logout' ||
    pathname === '/api/auth/change-password' ||
    pathname.startsWith('/api/auth/2fa')
  );
}

async function resolveTwoFactorStatus(request: NextAuthRequest) {
  const sessionUser = request.auth?.user;

  if (!sessionUser || !roleRequiresTwoFactor(sessionUser.role)) {
    return null;
  }

  const userId = typeof sessionUser.id === 'string' ? parseInt(sessionUser.id, 10) : sessionUser.id;
  const cookieNames = getTwoFactorCookieNames();

  return getTwoFactorStatus(
    userId,
    request.cookies.get(cookieNames.verified)?.value,
    request.cookies.get(cookieNames.trustedDevice)?.value,
  );
}

export default auth(async function middleware(request: NextAuthRequest) {
  const { pathname } = request.nextUrl;
  const sessionUser = request.auth?.user;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public') ||
    isPublicAuthRoute(pathname)
  ) {
    return NextResponse.next();
  }

  if (!sessionUser && !isPublicPage(pathname)) {
    const setupRequired = await needsInitialSetup();

    if (setupRequired) {
      return NextResponse.redirect(new URL('/setup', request.url));
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (sessionUser && isPublicPage(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (
    sessionUser &&
    sessionUser.mustChangePassword &&
    pathname !== '/change-password' &&
    pathname !== '/api/auth/change-password'
  ) {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  const twoFactorStatus = await resolveTwoFactorStatus(request);

  if (twoFactorStatus) {
    if (twoFactorStatus.requiresSetup) {
      if (isTwoFactorApiRoute(pathname)) {
        return NextResponse.next();
      }

      if (pathname !== '/two-factor/setup') {
        return NextResponse.redirect(new URL('/two-factor/setup', request.url));
      }
    }

    if (twoFactorStatus.requiresVerification) {
      if (isTwoFactorApiRoute(pathname)) {
        return NextResponse.next();
      }

      if (pathname !== '/two-factor/verify') {
        return NextResponse.redirect(new URL('/two-factor/verify', request.url));
      }
    }

    if (pathname === '/two-factor/setup' && !twoFactorStatus.requiresSetup) {
      return NextResponse.redirect(
        new URL(twoFactorStatus.requiresVerification ? '/two-factor/verify' : '/', request.url),
      );
    }

    if (pathname === '/two-factor/verify' && !twoFactorStatus.requiresVerification) {
      return NextResponse.redirect(
        new URL(twoFactorStatus.requiresSetup ? '/two-factor/setup' : '/', request.url),
      );
    }
  } else if (sessionUser && isTwoFactorPage(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

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

  if (pathname.startsWith('/api/')) {
    if (!sessionUser) {
      return NextResponse.json({ error: 'Autenticação necessária' }, { status: 401 });
    }

    if (isAdminOnlyApiRoute(pathname) && sessionUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 },
      );
    }

    if (twoFactorStatus?.requiresSetup && !isTwoFactorApiRoute(pathname)) {
      return NextResponse.json(
        { error: 'Configure a autenticação em duas etapas para continuar.' },
        { status: 403 },
      );
    }

    if (twoFactorStatus?.requiresVerification && !isTwoFactorApiRoute(pathname)) {
      return NextResponse.json(
        { error: 'Confirme o segundo fator para continuar.' },
        { status: 403 },
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
