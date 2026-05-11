'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

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

export default function TwoFactorVerifyPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    const loadStatus = async () => {
      try {
        const response = await fetch('/api/auth/2fa/status', { cache: 'no-store' });
        const data = (await response.json()) as TwoFactorStatusResponse;

        if (!response.ok) {
          throw new Error('Não foi possível validar o status da autenticação em duas etapas.');
        }

        if (data.mustChangePassword || data.isFirstLogin) {
          router.replace('/change-password');
          return;
        }

        if (data.twoFactor.verified || !data.twoFactor.required) {
          router.replace('/');
          return;
        }

        if (data.twoFactor.requiresSetup || !data.twoFactor.enabled) {
          router.replace('/two-factor/setup');
          return;
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : 'Erro ao carregar a verificação em duas etapas.';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    void loadStatus();
  }, [router, status]);

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          trustDevice,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível concluir a verificação.');
      }

      toast.success(data.message || 'Verificação concluída com sucesso.');
      router.push('/');
      router.refresh();
    } catch (verifyError) {
      const message =
        verifyError instanceof Error ? verifyError.message : 'Erro ao verificar o segundo fator.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-4 text-sm text-slate-600">Validando seu acesso seguro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
          Confirmação de acesso
        </span>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">Informe o código do autenticador</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Digite o código de 6 dígitos gerado no aplicativo autenticador. Se preferir, você também pode usar um
          código de recuperação de uso único.
        </p>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-4" onSubmit={handleVerify}>
          <div>
            <label htmlFor="verifyCode" className="block text-sm font-medium text-slate-700">
              Código do autenticador ou código de recuperação
            </label>
            <input
              id="verifyCode"
              type="text"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="000000 ou ABCD-EFGH"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-xl tracking-[0.15em] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(event) => setTrustDevice(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <strong className="block text-slate-900">Confiar neste dispositivo por 30 dias</strong>
              Útil para evitar atrito no dia a dia sem abrir mão da proteção para gestores e administradores.
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Validando acesso...' : 'Confirmar acesso'}
          </button>
        </form>
      </div>
    </div>
  );
}
