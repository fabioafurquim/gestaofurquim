'use client';

import { ReactNode, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import IdleSessionManager from '@/components/IdleSessionManager';

interface AuthLayoutProps {
  children: ReactNode;
  requiredRole?: 'ADMIN' | 'MANAGER' | 'USER';
  title?: string;
  fullWidth?: boolean;
}

type NavigationItem = {
  name: string;
  href: string;
  icon: string;
};

export default function AuthLayout({ children, title, fullWidth }: AuthLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.push('/login');
    },
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const user = session.user;

  const basicNavigation: NavigationItem[] = [
    { name: 'Painel', href: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6' },
    { name: 'Plantões', href: '/shifts', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { name: 'Mural de Trocas', href: '/swap-board', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  ];

  const managerNavigation: NavigationItem[] = [
    { name: 'Painel', href: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6' },
    { name: 'Plantões', href: '/shifts', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { name: 'Histórico de Exclusões', href: '/shift-deletion-history', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { name: 'Mural de Trocas', href: '/swap-board', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
    { name: 'Fisioterapeutas', href: '/physiotherapists', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { name: 'Equipes', href: '/teams', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { name: 'Feriados', href: '/holidays', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
    { name: 'Financeiro', href: '/financial-closing', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  const adminNavigation: NavigationItem[] = [
    { name: 'Painel', href: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6' },
    { name: 'Plantões', href: '/shifts', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { name: 'Histórico de Exclusões', href: '/shift-deletion-history', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { name: 'Mural de Trocas', href: '/swap-board', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
    { name: 'Fisioterapeutas', href: '/physiotherapists', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { name: 'Equipes', href: '/teams', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { name: 'Feriados', href: '/holidays', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
    { name: 'Usuários', href: '/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z' },
    { name: 'Contratos', href: '/contracts', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { name: 'Financeiro', href: '/financial-closing', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { name: 'Relatórios', href: '/reports/financial', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { name: 'Configurações', href: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { name: 'Manutenção', href: '/maintenance', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  const normalizeNavigation = (items: NavigationItem[]) =>
    items
      .filter((item) => item.href !== '/reports/financial')
      .map((item) =>
        item.href === '/financial-closing'
          ? { ...item, name: 'Fechamento Financeiro' }
          : item
      );

  const allNavigation =
    user.role === 'ADMIN'
      ? normalizeNavigation(adminNavigation)
      : user.role === 'MANAGER'
      ? normalizeNavigation(managerNavigation)
      : basicNavigation;

  const roleLabel =
    user.role === 'ADMIN' ? 'Administrador' : user.role === 'MANAGER' ? 'Gestor' : 'Usuário';

  return (
    <div className="min-h-screen bg-gray-50">
      <IdleSessionManager />
      <div className={`fixed inset-0 z-40 flex md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex h-full w-full max-w-xs flex-1 flex-col bg-gradient-to-b from-indigo-600 to-indigo-800">
          <div className="absolute right-0 top-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sr-only">Fechar sidebar</span>
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pb-4 pt-4">
            <div className="flex items-center border-b border-indigo-500/30 px-4 pb-4">
              <div className="relative mr-3 h-10 w-10">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  className="h-full w-full rounded-lg object-contain"
                  width={40}
                  height={40}
                  quality={100}
                  priority
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Gestão Furquim</h1>
                <p className="text-xs text-indigo-200">Sistema de Plantões</p>
              </div>
            </div>

            <nav className="mt-4 space-y-1 px-3">
              {allNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    pathname === item.href
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-indigo-100 hover:bg-white/10 hover:text-white'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <svg className="mr-3 h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="space-y-4 border-t border-indigo-500/30 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30">
                  <span className="text-sm font-semibold text-white">{user.name.charAt(0).toUpperCase()}</span>
                </div>
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs text-indigo-200">{roleLabel}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/change-password"
                className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15"
                onClick={() => setSidebarOpen(false)}
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Senha
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/15"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-indigo-600 to-indigo-800">
          <div className="flex flex-1 flex-col overflow-y-auto pb-4 pt-4">
            <div className="flex items-center border-b border-indigo-500/30 px-4 pb-4">
              <div className="relative mr-3 h-10 w-10">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  className="h-full w-full rounded-lg object-contain"
                  width={40}
                  height={40}
                  quality={100}
                  priority
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Gestão Furquim</h1>
                <p className="text-xs text-indigo-200">Sistema de Plantões</p>
              </div>
            </div>

            <nav className="mt-4 flex-1 space-y-1 px-3">
              {allNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    pathname === item.href
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-indigo-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <svg className="mr-3 h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="border-t border-indigo-500/30 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30">
                  <span className="text-sm font-semibold text-white">{user.name.charAt(0).toUpperCase()}</span>
                </div>
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs text-indigo-200">{roleLabel}</p>
              </div>
              <Link
                href="/change-password"
                className="ml-2 rounded-lg p-2 text-indigo-200 transition-colors hover:bg-white/10 hover:text-white"
                title="Trocar Senha"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </Link>
              <button
                onClick={handleLogout}
                className="ml-2 rounded-lg p-2 text-indigo-200 transition-colors hover:bg-white/10 hover:text-white"
                title="Sair"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col md:pl-64">
        <div className="sticky top-0 z-10 bg-gray-50 pl-1 pt-1 md:hidden sm:pl-3 sm:pt-3">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Abrir sidebar</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <main className="flex-1">
          <div className="h-full py-6">
            <div className={`${fullWidth ? 'w-full' : 'max-w-7xl'} mx-auto px-4 sm:px-6 md:px-8`}>
              {title && (
                <div className="mb-6">
                  <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
                </div>
              )}
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

