'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface NotificationSettings {
  id: number;
  enabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  instantNotificationEnabled: boolean;
  dailyReminderTemplate: string;
  instantNotificationTemplate: string;
}

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    fetchSettings();
  }, [session, status, router]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/notifications/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
      } else {
        setMessage({ type: 'error', text: 'Erro ao salvar configurações' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Erro ao carregar configurações</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🤖 Notificações Telegram</h1>
          <p className="mt-2 text-gray-600">
            Configure as notificações automáticas enviadas aos fisioterapeutas
          </p>
        </div>

        {/* Message Alert */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Settings Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* General Settings */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">⚙️ Configurações Gerais</h2>
            
            <div className="space-y-4">
              {/* Master Switch */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-900">
                    Sistema de Notificações
                  </label>
                  <p className="text-sm text-gray-500">
                    Habilitar ou desabilitar todas as notificações
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Daily Reminder Settings */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📅 Lembrete Diário</h2>
            
            <div className="space-y-4">
              {/* Daily Reminder Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-900">
                    Lembrete 1 Dia Antes
                  </label>
                  <p className="text-sm text-gray-500">
                    Enviar notificação 1 dia antes do plantão
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      dailyReminderEnabled: !settings.dailyReminderEnabled,
                    })
                  }
                  disabled={!settings.enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.dailyReminderEnabled && settings.enabled
                      ? 'bg-indigo-600'
                      : 'bg-gray-200'
                  } ${!settings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.dailyReminderEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Time Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horário do Envio
                </label>
                <input
                  type="time"
                  value={settings.dailyReminderTime}
                  onChange={(e) =>
                    setSettings({ ...settings, dailyReminderTime: e.target.value })
                  }
                  disabled={!settings.enabled || !settings.dailyReminderEnabled}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Horário em que as notificações diárias serão enviadas
                </p>
              </div>

              {/* Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensagem Personalizada
                </label>
                <textarea
                  value={settings.dailyReminderTemplate}
                  onChange={(e) =>
                    setSettings({ ...settings, dailyReminderTemplate: e.target.value })
                  }
                  disabled={!settings.enabled || !settings.dailyReminderEnabled}
                  rows={8}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Variáveis disponíveis:
                  </p>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>
                      <code className="bg-blue-100 px-1 rounded">{'{{name}}'}</code> - Nome do
                      fisioterapeuta
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">{'{{date}}'}</code> - Data do
                      plantão
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">{'{{period}}'}</code> - Período
                      (Manhã, Tarde, etc)
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">{'{{team}}'}</code> - Nome da
                      equipe
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Instant Notification Settings */}
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">⚡ Notificação Instantânea</h2>
            
            <div className="space-y-4">
              {/* Instant Notification Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-gray-900">
                    Notificar ao Cadastrar Plantão
                  </label>
                  <p className="text-sm text-gray-500">
                    Enviar notificação imediatamente quando um plantão for criado
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      instantNotificationEnabled: !settings.instantNotificationEnabled,
                    })
                  }
                  disabled={!settings.enabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.instantNotificationEnabled && settings.enabled
                      ? 'bg-indigo-600'
                      : 'bg-gray-200'
                  } ${!settings.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.instantNotificationEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensagem Personalizada
                </label>
                <textarea
                  value={settings.instantNotificationTemplate}
                  onChange={(e) =>
                    setSettings({ ...settings, instantNotificationTemplate: e.target.value })
                  }
                  disabled={!settings.enabled || !settings.instantNotificationEnabled}
                  rows={8}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Variáveis disponíveis:
                  </p>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>
                      <code className="bg-blue-100 px-1 rounded">{'{{name}}'}</code> - Nome do
                      fisioterapeuta
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">{'{{date}}'}</code> - Data do
                      plantão
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">{'{{period}}'}</code> - Período
                      (Manhã, Tarde, etc)
                    </li>
                    <li>
                      <code className="bg-blue-100 px-1 rounded">{'{{team}}'}</code> - Nome da
                      equipe
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Salvando...
              </>
            ) : (
              'Salvar Configurações'
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-900 mb-2">ℹ️ Informações Importantes</h3>
          <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
            <li>As notificações só serão enviadas para fisioterapeutas com Telegram vinculado</li>
            <li>O lembrete diário é executado via cron job no horário configurado</li>
            <li>A notificação instantânea é enviada imediatamente ao criar um plantão</li>
            <li>Você pode personalizar as mensagens usando as variáveis disponíveis</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
