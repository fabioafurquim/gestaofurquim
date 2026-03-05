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

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      // Verifica se é ADMIN
      if (session?.user?.role !== 'ADMIN') {
        router.push('/');
        return;
      }
      fetchSettings();
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

        {/* Outras configurações futuras podem ser adicionadas aqui */}
      </div>
    </AuthLayout>
  );
}
