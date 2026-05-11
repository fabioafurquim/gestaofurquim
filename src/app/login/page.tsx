'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface LoginFormData {
  email: string;
  password: string;
}

type TwoFactorStatusResponse = {
  mustChangePassword: boolean;
  isFirstLogin: boolean;
  twoFactor: {
    required: boolean;
    enabled: boolean;
    verified: boolean;
    requiresSetup: boolean;
    requiresVerification: boolean;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const response = await fetch('/api/auth/check-setup');
        const data = await response.json();

        if (data.needsSetup) {
          router.push('/setup');
          return;
        }
      } catch (setupError) {
        console.error('Erro ao verificar setup:', setupError);
      } finally {
        setCheckingSetup(false);
      }
    };

    void checkSetup();
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('reason') === 'expired') {
      setInfoMessage('Sua sessão expirou por inatividade. Faça login novamente para continuar.');
    }
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { signIn } = await import('next-auth/react');
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error('Email ou senha inválidos.');
      }

      if (result?.ok) {
        const statusResponse = await fetch('/api/auth/2fa/status', {
          cache: 'no-store',
        });
        const statusData = (await statusResponse.json()) as TwoFactorStatusResponse;

        if (!statusResponse.ok) {
          throw new Error('Não foi possível validar o status de segurança do seu acesso.');
        }

        if (statusData.mustChangePassword || statusData.isFirstLogin) {
          router.push('/change-password');
        } else if (statusData.twoFactor.requiresSetup) {
          router.push('/two-factor/setup');
        } else if (statusData.twoFactor.requiresVerification) {
          router.push('/two-factor/verify');
        } else {
          router.push('/');
        }

        router.refresh();
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-4 text-gray-600">Verificando configuração...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Plantão Fisio</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Faça login para acessar o sistema</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {infoMessage && (
            <div className="rounded-md bg-blue-50 p-4">
              <p className="text-sm text-blue-800">{infoMessage}</p>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="relative mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="Digite seu email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleInputChange}
                className="relative mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                placeholder="Digite sua senha"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">Não possui acesso? Entre em contato com o administrador.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
