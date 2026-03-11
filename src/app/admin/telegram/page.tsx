'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AuthLayout from '@/components/AuthLayout';

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  ip_address?: string;
}

interface BotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

export default function TelegramAdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    
    if (session?.user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }

    loadTelegramStatus();
  }, [status, session, router]);

  const loadTelegramStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/telegram/status');
      if (response.ok) {
        const data = await response.json();
        setWebhookInfo(data.webhook);
        setBotInfo(data.bot);
      } else {
        setError('Erro ao carregar status do Telegram');
      }
    } catch (err) {
      setError('Erro ao conectar com a API');
    } finally {
      setLoading(false);
    }
  };

  const handleSetWebhook = async () => {
    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/admin/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set' }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Webhook configurado com sucesso!');
        await loadTelegramStatus();
      } else {
        setError(data.error || 'Erro ao configurar webhook');
      }
    } catch (err) {
      setError('Erro ao configurar webhook');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!confirm('Tem certeza que deseja remover o webhook? O bot parará de receber mensagens.')) {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/admin/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Webhook removido com sucesso!');
        await loadTelegramStatus();
      } else {
        setError(data.error || 'Erro ao remover webhook');
      }
    } catch (err) {
      setError('Erro ao remover webhook');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestBot = async () => {
    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/admin/telegram/test', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Bot testado com sucesso! Mensagem enviada para ${data.sentTo} fisioterapeuta(s)`);
      } else {
        setError(data.error || 'Erro ao testar bot');
      }
    } catch (err) {
      setError('Erro ao testar bot');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout title="Administração Telegram" requiredRole="ADMIN">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Administração Telegram" requiredRole="ADMIN">
      <div className="space-y-6">
        {/* Mensagens */}
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Informações do Bot */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">🤖 Informações do Bot</h2>
          {botInfo ? (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Nome</dt>
                <dd className="mt-1 text-sm text-gray-900">{botInfo.first_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Username</dt>
                <dd className="mt-1 text-sm text-gray-900">@{botInfo.username}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{botInfo.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ✅ Ativo
                  </span>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">Não foi possível carregar informações do bot</p>
          )}
        </div>

        {/* Status do Webhook */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">🔗 Status do Webhook</h2>
          {webhookInfo ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-1 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">URL do Webhook</dt>
                  <dd className="mt-1 text-sm text-gray-900 break-all">
                    {webhookInfo.url || <span className="text-red-600">❌ Não configurado</span>}
                  </dd>
                </div>
                {webhookInfo.url && (
                  <>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Mensagens Pendentes</dt>
                      <dd className="mt-1 text-sm text-gray-900">{webhookInfo.pending_update_count}</dd>
                    </div>
                    {webhookInfo.last_error_message && (
                      <div>
                        <dt className="text-sm font-medium text-red-500">Último Erro</dt>
                        <dd className="mt-1 text-sm text-red-600">{webhookInfo.last_error_message}</dd>
                        {webhookInfo.last_error_date && (
                          <dd className="mt-1 text-xs text-gray-500">
                            {new Date(webhookInfo.last_error_date * 1000).toLocaleString('pt-BR')}
                          </dd>
                        )}
                      </div>
                    )}
                    {webhookInfo.ip_address && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">IP do Servidor</dt>
                        <dd className="mt-1 text-sm text-gray-900">{webhookInfo.ip_address}</dd>
                      </div>
                    )}
                  </>
                )}
              </dl>

              <div className="flex gap-3 pt-4 border-t">
                {!webhookInfo.url ? (
                  <button
                    onClick={handleSetWebhook}
                    disabled={actionLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {actionLoading ? 'Configurando...' : '🔗 Configurar Webhook'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSetWebhook}
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {actionLoading ? 'Atualizando...' : '🔄 Reconfigurar Webhook'}
                    </button>
                    <button
                      onClick={handleDeleteWebhook}
                      disabled={actionLoading}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      {actionLoading ? 'Removendo...' : '🗑️ Remover Webhook'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Não foi possível carregar informações do webhook</p>
          )}
        </div>

        {/* Ações */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">🛠️ Ações</h2>
          <div className="space-y-3">
            <button
              onClick={handleTestBot}
              disabled={actionLoading}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {actionLoading ? 'Testando...' : '🧪 Testar Bot (Enviar Mensagem de Teste)'}
            </button>
            <button
              onClick={loadTelegramStatus}
              disabled={actionLoading}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {actionLoading ? 'Atualizando...' : '🔄 Atualizar Status'}
            </button>
          </div>
        </div>

        {/* Documentação */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-blue-900 mb-2">📚 Informações Importantes</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li><strong>Desenvolvimento:</strong> Use o script de polling (node scripts/telegram-polling.js)</li>
            <li><strong>Produção:</strong> Configure o webhook apontando para https://fisio.furquim.cloud/api/telegram/webhook</li>
            <li><strong>Webhook:</strong> Só funciona com HTTPS válido (certificado SSL)</li>
            <li><strong>Cron Jobs:</strong> Configure no Coolify para executar notificações diárias</li>
          </ul>
        </div>
      </div>
    </AuthLayout>
  );
}
