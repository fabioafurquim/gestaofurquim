'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { FiArrowLeft, FiDownload, FiLoader } from 'react-icons/fi';

interface FormData {
  nomeempresa: string;
  cnpjempresa: string;
  enderecoempresa: string;
  nomerepresentante: string;
  cpf: string;
  rg: string;
  crefito: string;
  endereco: string;
  dtInicio: string;
  valorPlantao: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoPix: string;
  chavePix: string;
  anoassinatura: string;
}

interface Physiotherapist {
  id: number;
  name: string;
  email: string;
  crefito: string;
  cpf: string;
  rg?: string;
  address?: string;
  hourValue: number;
  banco?: string;
  agencia?: string;
  conta?: string;
  tipoPix?: string;
  chavePix?: string;
  nomeEmpresa?: string;
  cnpjEmpresa?: string;
  enderecoEmpresa?: string;
}

const ContractPJFormPage = () => {
  const router = useRouter();
  const params = useParams();
  const physiotherapistId = params.id as string;
  
  const [physiotherapist, setPhysiotherapist] = useState<Physiotherapist | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    nomeempresa: '',
    cnpjempresa: '',
    enderecoempresa: '',
    nomerepresentante: '',
    cpf: '',
    rg: '',
    crefito: '',
    endereco: '',
    dtInicio: '',
    valorPlantao: '',
    banco: '',
    agencia: '',
    conta: '',
    tipoPix: '',
    chavePix: '',
    anoassinatura: new Date().getFullYear().toString()
  });

  useEffect(() => {
    if (physiotherapistId) {
      fetchPhysiotherapist();
    }
  }, [physiotherapistId]);

  const fetchPhysiotherapist = async () => {
    try {
      const response = await fetch(`/api/physiotherapists/${physiotherapistId}`);
      if (!response.ok) {
        throw new Error('Fisioterapeuta não encontrado');
      }
      const data = await response.json();
      setPhysiotherapist(data);
      
      // Pré-preenchimento do formulário
      setFormData({
        nomeempresa: data.nomeEmpresa || '',
        cnpjempresa: data.cnpjEmpresa || '',
        enderecoempresa: data.enderecoEmpresa || '',
        nomerepresentante: data.name || '',
        cpf: data.cpf || '',
        rg: data.rg || '',
        crefito: data.crefito || '',
        endereco: data.address || '',
        dtInicio: '',
        valorPlantao: data.hourValue?.toString() || '',
        banco: data.banco || '',
        agencia: data.agencia || '',
        conta: data.conta || '',
        tipoPix: data.tipoPix || '',
        chavePix: data.chavePix || '',
        anoassinatura: new Date().getFullYear().toString()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    
    try {
      const response = await fetch('/api/contracts/generate-pj', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao gerar contrato');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contrato_pj_${physiotherapist?.name?.replace(/\s+/g, '_')}.docx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar contrato');
    } finally {
      setGenerating(false);
    }
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
          <h3 className="text-sm font-medium text-red-800">Erro</h3>
          <p className="mt-2 text-sm text-red-700">{error}</p>
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Gerar Contrato PJ - {physiotherapist?.name}
        </h1>
        <p className="text-gray-600">
          Preencha os dados para gerar o contrato de Pessoa Jurídica
        </p>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados da Empresa</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="nomeempresa" className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Empresa *
              </label>
              <input
                type="text"
                id="nomeempresa"
                name="nomeempresa"
                value={formData.nomeempresa}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="cnpjempresa" className="block text-sm font-medium text-gray-700 mb-1">
                CNPJ da Empresa *
              </label>
              <input
                type="text"
                id="cnpjempresa"
                name="cnpjempresa"
                value={formData.cnpjempresa}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="mb-6">
            <label htmlFor="enderecoempresa" className="block text-sm font-medium text-gray-700 mb-1">
              Endereço da Empresa *
            </label>
            <textarea
              id="enderecoempresa"
              name="enderecoempresa"
              value={formData.enderecoempresa}
              onChange={handleChange}
              required
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados do Representante</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="nomerepresentante" className="block text-sm font-medium text-gray-700 mb-1">
                Nome Completo do Representante *
              </label>
              <input
                type="text"
                id="nomerepresentante"
                name="nomerepresentante"
                value={formData.nomerepresentante}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">
                CPF *
              </label>
              <input
                type="text"
                id="cpf"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="rg" className="block text-sm font-medium text-gray-700 mb-1">
                RG *
              </label>
              <input
                type="text"
                id="rg"
                name="rg"
                value={formData.rg}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="crefito" className="block text-sm font-medium text-gray-700 mb-1">
                CREFITO *
              </label>
              <input
                type="text"
                id="crefito"
                name="crefito"
                value={formData.crefito}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="endereco" className="block text-sm font-medium text-gray-700 mb-1">
              Endereço *
            </label>
            <textarea
              id="endereco"
              name="endereco"
              value={formData.endereco}
              onChange={handleChange}
              required
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados do Contrato</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="dtInicio" className="block text-sm font-medium text-gray-700 mb-1">
                Data de Início *
              </label>
              <input
                type="date"
                id="dtInicio"
                name="dtInicio"
                value={formData.dtInicio}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="valorPlantao" className="block text-sm font-medium text-gray-700 mb-1">
                Valor do Plantão *
              </label>
              <input
                type="text"
                id="valorPlantao"
                name="valorPlantao"
                value={formData.valorPlantao}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="anoassinatura" className="block text-sm font-medium text-gray-700 mb-1">
                Ano de Assinatura *
              </label>
              <input
                type="text"
                id="anoassinatura"
                name="anoassinatura"
                value={formData.anoassinatura}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados Bancários</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="banco" className="block text-sm font-medium text-gray-700 mb-1">
                Banco *
              </label>
              <input
                type="text"
                id="banco"
                name="banco"
                value={formData.banco}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="agencia" className="block text-sm font-medium text-gray-700 mb-1">
                Agência *
              </label>
              <input
                type="text"
                id="agencia"
                name="agencia"
                value={formData.agencia}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="conta" className="block text-sm font-medium text-gray-700 mb-1">
                Conta *
              </label>
              <input
                type="text"
                id="conta"
                name="conta"
                value={formData.conta}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tipoPix" className="block text-sm font-medium text-gray-700 mb-1">
                Tipo PIX *
              </label>
              <input
                type="text"
                id="tipoPix"
                name="tipoPix"
                value={formData.tipoPix}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="chavePix" className="block text-sm font-medium text-gray-700 mb-1">
                Chave PIX *
              </label>
              <input
                type="text"
                id="chavePix"
                name="chavePix"
                value={formData.chavePix}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Botão de Gerar */}
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={generating}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <FiLoader className="animate-spin mr-2" size={20} />
            ) : (
              <FiDownload className="mr-2" size={20} />
            )}
            {generating ? 'Gerando Contrato...' : 'Gerar Contrato PJ'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ContractPJFormPage;