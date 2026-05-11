'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

type SetupData = {
  secret: string;
  qrCodeDataUrl: string;
  otpAuthUrl: string;
};

type TwoFactorStatusResponse = {
  mustChangePassword: boolean;
  isFirstLogin: boolean;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  twoFactor: {
    required: boolean;
    enabled: boolean;
    verified: boolean;
    requiresSetup: boolean;
    requiresVerification: boolean;
  };
};

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    const loadSetup = async () => {
      try {
        const statusResponse = await fetch('/api/auth/2fa/status', { cache: 'no-store' });
        const statusData = (await statusResponse.json()) as TwoFactorStatusResponse;

        if (!statusResponse.ok) {
          throw new Error('Não foi possível verificar o status da autenticação em duas etapas.');
        }

        if (statusData.mustChangePassword || statusData.isFirstLogin) {
          router.replace('/change-password');
          return;
        }

        if (!statusData.twoFactor.required) {
          router.replace('/');
          return;
        }

        if (statusData.twoFactor.enabled && statusData.twoFactor.verified) {
          router.replace('/');
          return;
        }

        if (statusData.twoFactor.enabled && statusData.twoFactor.requiresVerification) {
          router.replace('/two-factor/verify');
          return;
        }

        const response = await fetch('/api/auth/2fa/setup', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Não foi possível preparar a autenticação em duas etapas.');
        }

        setSetupData(data);
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : 'Erro ao carregar a configuração do 2FA.';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    void loadSetup();
  }, [router, status]);

  const handleEnable = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/auth/2fa/enable', {
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
        throw new Error(data.error || 'Não foi possível habilitar a autenticação em duas etapas.');
      }

      setRecoveryCodes(data.recoveryCodes ?? []);
      setCode('');
      toast.success('Autenticação em duas etapas habilitada com sucesso.');
    } catch (enableError) {
      const message =
        enableError instanceof Error
          ? enableError.message
          : 'Erro ao habilitar a autenticação em duas etapas.';
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
          <p className="mt-4 text-sm text-slate-600">Preparando a autenticação em duas etapas...</p>
        </div>
      </div>
    );
  }

  if (recoveryCodes.length > 0) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-100 bg-white p-8 shadow-sm">
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Proteção habilitada
          </span>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">Guarde seus códigos de recuperação</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Estes códigos permitem recuperar o acesso se você perder o celular ou o aplicativo autenticador.
            Cada código funciona uma única vez. Guarde em um local seguro.
          </p>

          <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:grid-cols-2">
            {recoveryCodes.map((recoveryCode) => (
              <div
                key={recoveryCode}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center font-mono text-lg font-semibold tracking-[0.2em] text-slate-900"
              >
                {recoveryCode}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(recoveryCodes.join('\n'));
                toast.success('Códigos copiados para a área de transferência.');
              }}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Copiar códigos
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Concluir e acessar o sistema
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Etapa obrigatória para gestores e administradores
            </span>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900">Ative a autenticação em duas etapas</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Para proteger os dados sensíveis do piloto, o acesso de gestores e administradores passa a exigir
              um segundo fator. Use o Google Authenticator, Microsoft Authenticator, Authy ou outro app compatível
              com códigos TOTP.
            </p>

            {error && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <ol className="mt-8 space-y-4 text-sm text-slate-700">
              <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <strong className="block text-slate-900">1. Escaneie o QR Code</strong>
                Abra o aplicativo autenticador no celular e adicione uma nova conta por QR Code.
              </li>
              <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <strong className="block text-slate-900">2. Digite o código de 6 dígitos</strong>
                Após escanear, o app começará a gerar códigos que mudam a cada 30 segundos.
              </li>
              <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <strong className="block text-slate-900">3. Guarde os códigos de recuperação</strong>
                Depois da confirmação, o sistema mostrará códigos de recuperação de uso único.
              </li>
            </ol>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            {setupData ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <Image
                    src={setupData.qrCodeDataUrl}
                    alt="QR Code para configurar a autenticação em duas etapas"
                    className="mx-auto h-60 w-60 rounded-xl"
                    width={240}
                    height={240}
                    unoptimized
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chave manual</p>
                  <p className="mt-2 break-all font-mono text-sm font-semibold tracking-[0.15em] text-slate-900">
                    {setupData.secret}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(setupData.secret);
                      toast.success('Chave manual copiada.');
                    }}
                    className="mt-3 text-sm font-medium text-blue-600 transition hover:text-blue-700"
                  >
                    Copiar chave manual
                  </button>
                </div>

                <form className="mt-6 space-y-4" onSubmit={handleEnable}>
                  <div>
                    <label htmlFor="twoFactorCode" className="block text-sm font-medium text-slate-700">
                      Código do autenticador
                    </label>
                    <input
                      id="twoFactorCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="000000"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-xl tracking-[0.35em] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={trustDevice}
                      onChange={(event) => setTrustDevice(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      <strong className="block text-slate-900">Confiar neste dispositivo por 30 dias</strong>
                      Assim você não precisará informar o código em todo login neste navegador.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Habilitando proteção...' : 'Habilitar autenticação em duas etapas'}
                  </button>
                </form>
              </>
            ) : (
              <p className="text-sm text-slate-600">Não foi possível carregar o QR Code.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
