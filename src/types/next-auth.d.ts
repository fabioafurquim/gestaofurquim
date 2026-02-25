import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      email: string;
      name: string;
      role: 'ADMIN' | 'USER';
      physiotherapistId: number | null;
      isFirstLogin: boolean;
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'USER';
    physiotherapistId: number | null;
    isFirstLogin: boolean;
    mustChangePassword: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: number;
    email: string;
    name: string;
    role: 'ADMIN' | 'USER';
    physiotherapistId: number | null;
    isFirstLogin: boolean;
    mustChangePassword: boolean;
  }
}
