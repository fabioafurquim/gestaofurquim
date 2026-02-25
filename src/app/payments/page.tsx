'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiCalendar, FiDollarSign } from 'react-icons/fi';
import AuthLayout from '@/components/AuthLayout';

/**
 * Página principal de Pagamentos
 * Permite selecionar o mês de referência para processamento dos pagamentos
 */
const PaymentsPage = () => {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState('');

  /**
   * Gera as opções de meses para o select
   * Inclui os últimos 12 meses a partir do mês atual
   */
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

  const handleMonthSelection = () => {
    if (selectedMonth) {
      router.push(`/payments/process/${selectedMonth}`);
    }
  };

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  return (
    <AuthLayout title="Pagamentos">
      <div className="mb-6">
        <p className="text-gray-600">
          Selecione o mês de referência para processar os pagamentos dos fisioterapeutas
        </p>
      </div>
      
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-8">
          <div className="max-w-md mx-auto">
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
            
            <button
              onClick={handleMonthSelection}
              disabled={!selectedMonth}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Processar Pagamentos
            </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};

export default PaymentsPage;