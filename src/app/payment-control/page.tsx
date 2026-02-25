'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiCalendar, FiDollarSign, FiCheck, FiClock, FiAlertCircle } from 'react-icons/fi';
import AuthLayout from '@/components/AuthLayout';

interface PaymentControl {
  id: number;
  referenceMonth: string;
  status: 'OPEN' | 'PROCESSING' | 'CLOSED';
  createdAt: string;
  closedAt: string | null;
  _count: {
    payments: number;
  };
}

/**
 * Componente interno que usa useSearchParams
 */
function PaymentControlContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [controls, setControls] = useState<PaymentControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [creating, setCreating] = useState(false);
  const [googleAuth, setGoogleAuth] = useState<{ authenticated: boolean; authUrl?: string } | null>(null);

  // Mensagens de sucesso/erro da URL
  const successMessage = searchParams.get('success');
  const errorMessage = searchParams.get('error');

  useEffect(() => {
    fetchControls();
    checkGoogleAuth();
  }, []);

  const fetchControls = async () => {
    try {
      const response = await fetch('/api/payment-control');
      if (response.ok) {
        const data = await response.json();
        setControls(data);
      }
    } catch (error) {
      console.error('Erro ao carregar controles:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkGoogleAuth = async () => {
    try {
      const response = await fetch('/api/auth/google');
      if (response.ok) {
        const data = await response.json();
        setGoogleAuth(data);
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação Google:', error);
    }
  };

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthName = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      
      options.push({
        value: `${year}-${month}`,
        label: monthName.charAt(0).toUpperCase() + monthName.slice(1)
      });
    }
    
    return options;
  };

  const handleCreateControl = async () => {
    if (!selectedMonth) return;

    setCreating(true);
    try {
      const response = await fetch('/api/payment-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceMonth: selectedMonth }),
      });

      if (response.ok) {
        router.push(`/payment-control/${selectedMonth}`);
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao criar controle de pagamento');
      }
    } catch (error) {
      console.error('Erro ao criar controle:', error);
      alert('Erro ao criar controle de pagamento');
    } finally {
      setCreating(false);
    }
  };

  const formatMonthName = (referenceMonth: string) => {
    const [year, month] = referenceMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <FiClock className="mr-1" /> Em Aberto
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <FiClock className="mr-1" /> Processando
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <FiCheck className="mr-1" /> Fechado
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <AuthLayout title="Controle de Pagamentos">
      {/* Mensagens de sucesso/erro */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <FiCheck className="text-green-500 mr-2" />
          <span className="text-green-700">{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <FiAlertCircle className="text-red-500 mr-2" />
          <span className="text-red-700">{errorMessage}</span>
        </div>
      )}

      {/* Status do Google */}
      {googleAuth && !googleAuth.authenticated && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FiAlertCircle className="text-yellow-500 mr-2" />
              <span className="text-yellow-700">
                Google Drive e Gmail não configurados. Configure para habilitar upload de arquivos e envio de e-mails.
              </span>
            </div>
            {googleAuth.authUrl && (
              <a
                href={googleAuth.authUrl}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Configurar Google
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mb-6">
        <p className="text-gray-600">
          Gerencie os pagamentos mensais dos fisioterapeutas. Selecione um mês existente ou crie um novo controle.
        </p>
      </div>

      {/* Criar novo controle */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Novo Controle de Pagamento</h2>
        </div>
        <div className="px-6 py-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 mb-2">
                Mês de Referência
              </label>
              <select
                id="month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">Selecione um mês...</option>
                {generateMonthOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCreateControl}
              disabled={!selectedMonth || creating}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              <FiCalendar className="mr-2" />
              {creating ? 'Criando...' : 'Abrir Controle'}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de controles existentes */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Histórico de Pagamentos</h2>
        </div>
        <div className="px-6 py-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Carregando...</p>
            </div>
          ) : controls.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FiDollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2">Nenhum controle de pagamento encontrado.</p>
              <p className="text-sm">Selecione um mês acima para começar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mês de Referência
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registros
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Criado em
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {controls.map((control) => (
                    <tr key={control.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatMonthName(control.referenceMonth)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(control.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {control._count.payments} fisioterapeutas
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(control.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => router.push(`/payment-control/${control.referenceMonth}`)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}

/**
 * Página principal de Controle de Pagamentos
 * Lista os meses disponíveis e permite criar novos controles
 */
export default function PaymentControlPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <PaymentControlContent />
    </Suspense>
  );
}
