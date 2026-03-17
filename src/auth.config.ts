import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authenticateUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function extractIpAddress(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }

  return realIp?.trim() || null;
}

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/');
      const isOnLogin = nextUrl.pathname.startsWith('/login');
      const isOnSetup = nextUrl.pathname.startsWith('/setup');
      const isOnChangePassword = nextUrl.pathname.startsWith('/change-password');
      
      // Permitir acesso à página de troca de senha se estiver logado
      if (isOnChangePassword && isLoggedIn) {
        return true;
      }
      
      if (isOnDashboard && !isOnLogin && !isOnSetup && !isOnChangePassword) {
        if (isLoggedIn) return true;
        return false;
      } else if (isLoggedIn && (isOnLogin || isOnSetup)) {
        return Response.redirect(new URL('/', nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.physiotherapistId = user.physiotherapistId;
        token.isFirstLogin = user.isFirstLogin;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        const sessionUser = session.user as any;

        sessionUser.id = Number(token.id);
        sessionUser.email = token.email as string;
        sessionUser.name = token.name as string;
        sessionUser.role = token.role as 'ADMIN' | 'MANAGER' | 'USER';
        sessionUser.physiotherapistId = token.physiotherapistId as number | null;
        sessionUser.isFirstLogin = token.isFirstLogin as boolean;
        sessionUser.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials, request) {
        const { email, password } = credentials as { email: string; password: string };
        
        const user = await authenticateUser(email, password);
        
        if (!user) {
          return null;
        }

        await prisma.userAccessLog.create({
          data: {
            userId: user.id,
            userEmail: user.email,
            userName: user.name,
            userRole: user.role,
            ipAddress: extractIpAddress(request),
            userAgent: request.headers.get('user-agent'),
          },
        }).catch((error) => {
          console.error('Erro ao registrar log de acesso:', error);
        });
        
        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          physiotherapistId: user.physiotherapistId ?? null,
          isFirstLogin: user.isFirstLogin,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
} satisfies NextAuthConfig;
