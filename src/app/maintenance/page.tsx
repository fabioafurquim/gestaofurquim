'use client';

import { useState } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { FiDatabase, FiDownload, FiAlertTriangle, FiCheck, FiX } from 'react-icons/fi';

export default function MaintenancePage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const createDatabaseDump = async () => {
    if (!confirm('Tem certeza que deseja criar um backup completo do banco de dados PostgreSQL?')) {
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      
      const response = await fetch('/api/maintenance/create-dump', {
        method: 'POST',
      });
      
      if (response.ok) {
        // Criar um link para download do arquivo
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plantaofisio-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setMessage({ type: 'success', text: 'Backup do banco de dados criado e baixado com sucesso!' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Erro ao criar backup do banco de dados' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao conectar com o servidor' });
    } finally {
      setLoading(false);
    }
  };



  return (
    <AuthLayout title="Manutenção do Sistema" requiredRole="ADMIN">
      <div className="space-y-6">
        <p className="text-gray-600">
          Crie um backup completo do banco de dados PostgreSQL em formato JSON.
        </p>

        {/* Mensagens */}
        {message && (
          <div className={`p-4 rounded-md flex items-center space-x-2 ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <FiCheck className="h-5 w-5" />
            ) : (
              <FiX className="h-5 w-5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Backup do Banco de Dados */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <FiDatabase className="mr-2" />
            Backup do Banco de Dados
          </h2>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Criar Backup do PostgreSQL</h3>
              <p className="text-sm text-gray-500">
                Gera um arquivo JSON com todos os dados do banco de dados para download
              </p>
            </div>
            <button
              onClick={createDatabaseDump}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Criando Backup...
                </>
              ) : (
                <>
                  <FiDownload className="mr-2 h-4 w-4" />
                  Criar Backup
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}