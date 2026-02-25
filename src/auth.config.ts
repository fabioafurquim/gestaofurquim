import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authenticateUser } from '@/lib/auth';

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
      
      if (isOnDashboard && !isOnLogin && !isOnSetup) {
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
        session.user.id = token.id as number;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as 'ADMIN' | 'USER';
        session.user.physiotherapistId = token.physiotherapistId as number | null;
        session.user.isFirstLogin = token.isFirstLogin as boolean;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const { email, password } = credentials as { email: string; password: string };
        
        const user = await authenticateUser(email, password);
        
        if (!user) {
          return null;
        }
        
        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          physiotherapistId: user.physiotherapistId,
          isFirstLogin: user.isFirstLogin,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
} satisfies NextAuthConfig;
