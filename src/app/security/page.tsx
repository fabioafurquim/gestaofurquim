'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import AuthLayout from '@/components/AuthLayout';

type TrustedDevice = {
  id: number;
  label: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: string | null;
  expiresAt: string;
  createdAt: string;
};

type SecurityStatus = {
  mustChangePassword: boolean;
  isFirstLogin: boolean;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  twoFactor: {
    required: boolean;
    enabled: boolean;
    verified: boolean;
    requiresSetup: boolean;
    requiresVerification: boolean;
    recoveryCodesRemaining: number;
    enabledAt: string | null;
  };
};

export default function SecurityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<SecurityStatus | null>(null);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [actionCode, setActionCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [submittingAction, setSubmittingAction] = useState<'regenerate' | 'reset' | null>(null);

  const loadData = async () => {
    try {
      const [statusResponse, devicesResponse] = await Promise.all([
        fetch('/api/auth/2fa/status', { cache: 'no-store' }),
        fetch('/api/auth/2fa/trusted-devices', { cache: 'no-store' }),
      ]);
      const statusPayload = await statusResponse.json();
      const devicesPayload = await devicesResponse.json();

      if (!statusResponse.ok) {
        throw new Error(statusPayload.error || 'Não foi possível carregar o status de segurança.');
      }

      if (!devicesResponse.ok) {
        throw new Error(devicesPayload.error || 'Não foi possível carregar os dispositivos confiáveis.');
      }

      setStatusData(statusPayload);
      setTrustedDevices(devicesPayload.devices ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar a área de segurança.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const enabledAtLabel = useMemo(() => {
    if (!statusData?.twoFactor.enabledAt) {
      return null;
    }

    return new Date(statusData.twoFactor.enabledAt).toLocaleString('pt-BR');
  }, [statusData?.twoFactor.enabledAt]);

  const handleRegenerateRecoveryCodes = async () => {
    if (!actionCode.trim()) {
      toast.error('Informe um código do autenticador ou um código de recuperação.');
      return;
    }

    setSubmittingAction('regenerate');

    try {
      const response = await fetch('/api/auth/2fa/recovery-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: actionCode }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível gerar novos códigos de recuperação.');
      }

      setRecoveryCodes(data.recoveryCodes ?? []);
      setActionCode('');
      toast.success(data.message || 'Novos códigos de recuperação gerados com sucesso.');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar novos códigos de recuperação.');
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleResetTwoFactor = async () => {
    if (!actionCode.trim()) {
      toast.error('Informe um código do autenticador ou um código de recuperação.');
      return;
    }

    setSubmittingAction('reset');

    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: actionCode }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível redefinir a autenticação em duas etapas.');
      }

      toast.success(data.message || 'Autenticação em duas etapas redefinida.');
      router.push('/two-factor/setup');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao redefinir a autenticação em duas etapas.');
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleRevokeDevice = async (deviceId: number) => {
    try {
      const response = await fetch(`/api/auth/2fa/trusted-devices/${deviceId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível revogar o dispositivo.');
      }

      toast.success(data.message || 'Dispositivo revogado com sucesso.');
      setTrustedDevices((current) => current.filter((device) => device.id !== deviceId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao revogar o dispositivo.');
    }
  };

  return (
    <AuthLayout title="Segurança" fullWidth>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Autenticação em duas etapas</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Proteção do acesso administrativo</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Gestores e administradores precisam validar o login com um segundo fator. Isso reduz muito o risco
                de vazamento de dados mesmo se a senha de alguém cair em mãos erradas.
              </p>
            </div>

            {!loading && statusData?.twoFactor.enabled ? (
              <span className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
                Proteção ativa
              </span>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/two-factor/setup')}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Configurar agora
              </button>
            )}
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              Carregando informações de segurança...
            </div>
          ) : statusData ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {statusData.twoFactor.enabled ? 'Ativo' : 'Pendente'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Códigos restantes</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {statusData.twoFactor.recoveryCodesRemaining}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ativado em</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {enabledAtLabel ?? 'Ainda não configurado'}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        {statusData?.twoFactor.enabled && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Dispositivos confiáveis</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Navegadores confiáveis ficam liberados por 30 dias. Se algo parecer estranho, revoke na hora.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {trustedDevices.length} ativo{trustedDevices.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {trustedDevices.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    Nenhum dispositivo confiável ativo no momento.
                  </div>
                ) : (
                  trustedDevices.map((device) => (
                    <div
                      key={device.id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div>
                        <p className="text-base font-semibold text-slate-900">{device.label || 'Dispositivo confiável'}</p>
                        <p className="mt-1 text-sm text-slate-600">{device.ipAddress || 'IP não identificado'}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Último uso:{' '}
                          {device.lastUsedAt ? new Date(device.lastUsedAt).toLocaleString('pt-BR') : 'Ainda não registrado'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Expira em: {new Date(device.expiresAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevokeDevice(device.id)}
                        className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                      >
                        Revogar dispositivo
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">Operações sensíveis do 2FA</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Para gerar novos códigos de recuperação ou redefinir o segundo fator, confirme sua identidade com um
                código atual do autenticador ou um código de recuperação ainda não utilizado.
              </p>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <label htmlFor="securityActionCode" className="block text-sm font-medium text-slate-700">
                  Código do autenticador ou código de recuperação
                </label>
                <input
                  id="securityActionCode"
                  type="text"
                  value={actionCode}
                  onChange={(event) => setActionCode(event.target.value)}
                  placeholder="000000 ou ABCD-EFGH"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-lg tracking-[0.15em] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleRegenerateRecoveryCodes}
                    disabled={submittingAction !== null}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingAction === 'regenerate' ? 'Gerando novos códigos...' : 'Gerar novos códigos de recuperação'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetTwoFactor}
                    disabled={submittingAction !== null}
                    className="rounded-xl border border-amber-200 px-4 py-3 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submittingAction === 'reset' ? 'Redefinindo proteção...' : 'Redefinir autenticação em duas etapas'}
                  </button>
                </div>
              </div>

              {recoveryCodes.length > 0 && (
                <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Novos códigos de recuperação</p>
                      <p className="mt-1 text-sm text-emerald-700">
                        Guarde novamente estes códigos. Os anteriores foram invalidados.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(recoveryCodes.join('\n'));
                        toast.success('Códigos copiados para a área de transferência.');
                      }}
                      className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Copiar códigos
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {recoveryCodes.map((recoveryCode) => (
                      <div
                        key={recoveryCode}
                        className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-center font-mono text-base font-semibold tracking-[0.2em] text-slate-900"
                      >
                        {recoveryCode}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
