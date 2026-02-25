'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiFileText, FiUsers } from 'react-icons/fi';
import AuthLayout from '@/components/AuthLayout';

const ContractsPage = () => {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<'PJ' | 'RPA' | null>(null);

  const handleTypeSelection = (type: 'PJ' | 'RPA') => {
    setSelectedType(type);
    router.push(`/contracts/${type.toLowerCase()}`);
  };

  return (
    <AuthLayout title="Contratos">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Geração de Contratos</h1>
        <p className="text-gray-600">Selecione o tipo de contrato que deseja gerar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Contrato PJ */}
        <div 
          onClick={() => handleTypeSelection('PJ')}
          className="bg-white rounded-lg shadow-md border border-gray-200 p-6 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200"
        >
          <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-lg mb-4 mx-auto">
            <FiFileText className="text-blue-600" size={32} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">Contrato PJ</h3>
          <p className="text-gray-600 text-center mb-4">
            Gerar contrato para fisioterapeutas com regime de Pessoa Jurídica
          </p>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm text-blue-700 text-center">
              <strong>Inclui:</strong> Dados da empresa, CNPJ, representante legal e informações bancárias
            </p>
          </div>
        </div>

        {/* Contrato RPA */}
        <div 
          onClick={() => handleTypeSelection('RPA')}
          className="bg-white rounded-lg shadow-md border border-gray-200 p-6 cursor-pointer hover:shadow-lg hover:border-green-300 transition-all duration-200"
        >
          <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-lg mb-4 mx-auto">
            <FiUsers className="text-green-600" size={32} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">Contrato RPA</h3>
          <p className="text-gray-600 text-center mb-4">
            Gerar contrato para fisioterapeutas autônomos (Recibo de Pagamento Autônomo)
          </p>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-sm text-green-700 text-center">
              <strong>Inclui:</strong> Dados pessoais, CPF, RG, CREFITO e informações bancárias
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Informação Importante</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Apenas fisioterapeutas com o tipo de contrato correspondente (PJ ou RPA) 
                aparecerão na lista de seleção. Verifique o cadastro do fisioterapeuta 
                antes de gerar o contrato.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};

export default ContractsPage;