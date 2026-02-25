'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiUser, FiFileText } from 'react-icons/fi';

interface Physiotherapist {
  id: number;
  name: string;
  email: string;
  crefito: string;
  cpf: string;
  phone?: string;
  contractType: 'PJ' | 'RPA';
  status: 'ACTIVE' | 'INACTIVE';
}

const ContractsPJPage = () => {
  const router = useRouter();
  const [physiotherapists, setPhysiotherapists] = useState<Physiotherapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPhysiotherapists();
  }, []);

  const fetchPhysiotherapists = async () => {
    try {
      const response = await fetch('/api/physiotherapists?contractType=PJ&status=ACTIVE');
      if (!response.ok) {
        throw new Error('Erro ao carregar fisioterapeutas');
      }
      const data = await response.json();
      setPhysiotherapists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPhysiotherapist = (physiotherapistId: number) => {
    router.push(`/contracts/pj/form/${physiotherapistId}`);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Erro</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
          >
            <FiArrowLeft className="mr-2" size={20} />
            Voltar
          </button>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Contratos PJ</h1>
        <p className="text-gray-600">
          Selecione o fisioterapeuta para gerar o contrato de Pessoa Jurídica
        </p>
      </div>

      {/* Lista de Fisioterapeutas */}
      {physiotherapists.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <FiUser className="mx-auto h-12 w-12 text-yellow-400 mb-4" />
          <h3 className="text-lg font-medium text-yellow-800 mb-2">
            Nenhum fisioterapeuta encontrado
          </h3>
          <p className="text-yellow-700">
            Não há fisioterapeutas ativos com contrato do tipo PJ cadastrados no sistema.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {physiotherapists.map((physio) => (
            <div
              key={physio.id}
              onClick={() => handleSelectPhysiotherapist(physio.id)}
              className="bg-white rounded-lg shadow-md border border-gray-200 p-4 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full mr-3">
                    <FiUser className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{physio.name}</h3>
                    <p className="text-xs text-gray-500">CREFITO: {physio.crefito}</p>
                  </div>
                </div>
                <FiFileText className="text-gray-400" size={16} />
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-gray-600">
                  <strong>Email:</strong> {physio.email}
                </p>
                <p className="text-xs text-gray-600">
                  <strong>CPF:</strong> {physio.cpf}
                </p>
                {physio.phone && (
                  <p className="text-xs text-gray-600">
                    <strong>Telefone:</strong> {physio.phone}
                  </p>
                )}
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Contrato PJ
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContractsPJPage;