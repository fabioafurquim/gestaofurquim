'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AuthLayout from '@/components/AuthLayout';

interface SystemSettings {
  id: number;
  swapRequiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationSettings {
  id: number;
  enabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  instantNotificationEnabled: boolean;
  dailyReminderTemplate: string;
  instantNotificationTemplate: string;
}

interface NotificationLog {
  id: number;
  physiotherapist: {
    name: string;
  };
  status: string;
  sentAt: string;
  errorMessage?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingNotifications, setTestingNotifications] = useState(false);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [testResult, setTestResult] = useState<{ total: number; sent: number; failed: number } | null>(null);
  const [testError, setTestError] = useState('');
  const [testSuccess, setTestSuccess] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') {
        router.push('/');
        return;
      }
      fetchSettings();
      fetchNotificationSettings();
    }
  }, [sessionStatus, session, router]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/system-settings');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar configurações');
      }

      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotificationSettings = async () => {
    try {
      const response = await fetch('/api/notifications/settings');
      if (response.ok) {
        const data = await response.json();
        setNotificationSettings(data);
      }
    } catch (err) {
      console.error('Erro ao carregar configurações de notificações:', err);
    }
  };

  const handleToggleNotification = async (field: keyof NotificationSettings, value: boolean) => {
    if (!notificationSettings) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...notificationSettings,
          [field]: value,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotificationSettings(data.settings);
        setSuccess('Configurações atualizadas com sucesso!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Erro ao atualizar configurações');
      }
    } catch (err) {
      setError('Erro ao atualizar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotifications = async () => {
    try {
      setTestingNotifications(true);
      setTestError('');
      setTestSuccess('');
      setTestResult(null);
      setNotificationLogs([]);

      const cronSecret = process.env.NEXT_PUBLIC_CRON_SECRET;
      
      if (!cronSecret) {
        setTestError('❌ Erro: NEXT_PUBLIC_CRON_SECRET não configurado no .env.local');
        setTestingNotifications(false);
        return;
      }

      const response = await fetch('/api/cron/notify-shifts', {
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult(data);

        if (data.sent === 0 && data.total === 0) {
          setTestSuccess('ℹ️ Nenhum plantão cadastrado para amanhã. Cadastre um plantão para a data de amanhã e tente novamente.');
        } else if (data.sent > 0) {
          setTestSuccess(`✅ ${data.sent} notificação(ões) enviada(s) com sucesso!`);
          await fetchRecentLogs();
        } else if (data.total > 0 && data.sent === 0) {
          setTestError(`⚠️ Encontrados ${data.total} plantão(ões) para amanhã, mas nenhuma notificação foi enviada. Verifique se os fisioterapeutas têm Telegram vinculado.`);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setTestError(`❌ Erro ao executar teste: ${errorData.error || 'Verifique se CRON_SECRET está correto'}`);
      }
    } catch (err) {
      setTestError('❌ Erro ao executar teste de notificações. Verifique o console do navegador para mais detalhes.');
      console.error('Erro detalhado:', err);
    } finally {
      setTestingNotifications(false);
    }
  };

  const fetchRecentLogs = async () => {
    try {
      const response = await fetch('/api/notifications/logs?limit=10');
      if (response.ok) {
        const data = await response.json();
        setNotificationLogs(data);
      }
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    }
  };

  const handleToggleSwapApproval = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/system-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          swapRequiresApproval: !settings.swapRequiresApproval,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao atualizar configurações');
      }

      const updatedSettings = await response.json();
      setSettings(updatedSettings);
      setSuccess('Configurações atualizadas com sucesso!');
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <AuthLayout title="Configurações do Sistema">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AuthLayout>
    );
  }

  if (!settings) {
    return (
      <AuthLayout title="Configurações do Sistema">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          Erro ao carregar configurações
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Configurações do Sistema">
      <div className="space-y-6">
        {/* Mensagens */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Seção de Trocas de Plantões */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Trocas de Plantões</h2>
            <p className="mt-1 text-sm text-gray-500">
              Configure como as trocas de plantões devem funcionar no sistema
            </p>
          </div>

          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900">
                  Requer Aprovação de Gestor/Admin
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {settings.swapRequiresApproval
                    ? 'Trocas de plantões precisam ser aprovadas por um gestor ou administrador antes de serem efetivadas.'
                    : 'Trocas de plantões são efetivadas automaticamente quando aceitas pelo fisioterapeuta, sem necessidade de aprovação.'}
                </p>
              </div>

              <button
                onClick={handleToggleSwapApproval}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  settings.swapRequiresApproval ? 'bg-blue-600' : 'bg-gray-200'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="sr-only">Requer aprovação</span>
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.swapRequiresApproval ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Informação adicional */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Como funciona</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    {settings.swapRequiresApproval ? (
                      <ul className="list-disc list-inside space-y-1">
                        <li>Fisioterapeuta solicita troca de plantão</li>
                        <li>Outro fisioterapeuta aceita a troca</li>
                        <li>Troca fica com status "Aguardando Aprovação"</li>
                        <li>Gestor ou Admin aprova/rejeita a troca</li>
                        <li>Se aprovada, a troca é efetivada</li>
                      </ul>
                    ) : (
                      <ul className="list-disc list-inside space-y-1">
                        <li>Fisioterapeuta solicita troca de plantão</li>
                        <li>Outro fisioterapeuta aceita a troca</li>
                        <li>Troca é efetivada automaticamente</li>
                        <li>Não requer aprovação de gestor/admin</li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seção de Notificações Telegram */}
        {notificationSettings && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">🤖 Notificações Telegram</h2>
              <p className="mt-1 text-sm text-gray-500">
                Configure as notificações automáticas enviadas aos fisioterapeutas
              </p>
            </div>

            <div className="px-6 py-4 space-y-6">
              {/* Toggle: Sistema de Notificações */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">
                    Sistema de Notificações
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {notificationSettings.enabled
                      ? 'Todas as notificações estão habilitadas'
                      : 'Todas as notificações estão desabilitadas'}
                  </p>
                </div>

                <button
                  onClick={() => handleToggleNotification('enabled', !notificationSettings.enabled)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    notificationSettings.enabled ? 'bg-blue-600' : 'bg-gray-200'
                  } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="sr-only">Habilitar notificações</span>
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notificationSettings.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle: Notificação ao Criar Plantão */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">
                    ⚡ Notificação ao Criar Plantão
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Envia notificação imediatamente quando um novo plantão é cadastrado
                  </p>
                </div>

                <button
                  onClick={() => handleToggleNotification('instantNotificationEnabled', !notificationSettings.instantNotificationEnabled)}
                  disabled={saving || !notificationSettings.enabled}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    notificationSettings.instantNotificationEnabled && notificationSettings.enabled ? 'bg-blue-600' : 'bg-gray-200'
                  } ${saving || !notificationSettings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="sr-only">Notificação instantânea</span>
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notificationSettings.instantNotificationEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle: Notificação Automática (1 dia antes) */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">
                    📅 Notificação Automática (1 dia antes)
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Envia lembrete automático 1 dia antes de cada plantão (horário: {notificationSettings.dailyReminderTime})
                  </p>
                </div>

                <button
                  onClick={() => handleToggleNotification('dailyReminderEnabled', !notificationSettings.dailyReminderEnabled)}
                  disabled={saving || !notificationSettings.enabled}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    notificationSettings.dailyReminderEnabled && notificationSettings.enabled ? 'bg-blue-600' : 'bg-gray-200'
                  } ${saving || !notificationSettings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="sr-only">Lembrete diário</span>
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notificationSettings.dailyReminderEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Botão de Teste Manual */}
              <div className="pt-2">
                <button
                  onClick={handleTestNotifications}
                  disabled={testingNotifications || !notificationSettings.enabled || !notificationSettings.dailyReminderEnabled}
                  className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {testingNotifications ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Enviando notificações...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <span>Testar Notificações Automáticas Agora</span>
                    </>
                  )}
                </button>
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Envia notificações para todos os plantões de amanhã (teste manual)
                </p>

                {/* Mensagens de Feedback do Teste - Logo abaixo do botão */}
                {testSuccess && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">{testSuccess}</p>
                  </div>
                )}

                {testError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{testError}</p>
                  </div>
                )}
              </div>

              {/* Resultado do Teste */}
              {testResult && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">📊 Resultado do Teste</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{testResult.total}</p>
                      <p className="text-xs text-blue-800">Plantões encontrados</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{testResult.sent}</p>
                      <p className="text-xs text-green-800">Enviadas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{testResult.failed}</p>
                      <p className="text-xs text-red-800">Falhas</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Logs de Notificações */}
              {notificationLogs.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">📋 Notificações Enviadas</h4>
                  <div className="space-y-2">
                    {notificationLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-3 rounded-lg border ${
                          log.status === 'sent'
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {log.status === 'sent' ? (
                              <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            <span className="text-sm font-medium text-gray-900">
                              {log.physiotherapist.name}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(log.sentAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {log.errorMessage && (
                          <p className="mt-1 text-xs text-red-700">{log.errorMessage}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">ℹ️ Informações</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li>Notificações só são enviadas para fisioterapeutas com Telegram vinculado</li>
                        <li>O botão de teste envia notificações para plantões de amanhã</li>
                        <li>Em produção, as notificações automáticas rodam via cron job</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
