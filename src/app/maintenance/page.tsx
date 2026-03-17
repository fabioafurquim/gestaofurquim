'use client';

import { useEffect, useState } from 'react';
import AuthLayout from '@/components/AuthLayout';
import { FiAlertCircle, FiCheck, FiCloud, FiDatabase, FiDownload, FiExternalLink, FiRefreshCw, FiX } from 'react-icons/fi';

type MessageState = {
  type: 'success' | 'error';
  text: string;
};

type GoogleAuthState = {
  authenticated: boolean;
  authUrl?: string;
};

export default function MaintenancePage() {
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthState | null>(null);
  const [checkingGoogle, setCheckingGoogle] = useState(true);
  const [message, setMessage] = useState<MessageState | null>(null);

  useEffect(() => {
    void loadGoogleStatus();
  }, []);

  const loadGoogleStatus = async () => {
    try {
      setCheckingGoogle(true);

      const response = await fetch('/api/auth/google');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao verificar autenticação do Google.');
      }

      setGoogleAuth(data);
    } catch (error) {
      setGoogleAuth(null);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao verificar integração com Google.',
      });
    } finally {
      setCheckingGoogle(false);
    }
  };

  const downloadBackup = async () => {
    if (!confirm('Deseja gerar um backup real do PostgreSQL e baixar o arquivo agora?')) {
      return;
    }

    try {
      setDownloading(true);
      setMessage(null);

      const response = await fetch('/api/maintenance/create-dump', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao criar backup.');
      }

      const blob = await response.blob();
      const fileName =
        response.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ||
        `plantaofisio-postgres-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.dump`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      setMessage({
        type: 'success',
        text: 'Backup gerado e baixado com sucesso.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao baixar backup.',
      });
    } finally {
      setDownloading(false);
    }
  };

  const uploadBackupToDrive = async () => {
    if (!confirm('Deseja gerar um backup real do PostgreSQL e enviar o arquivo para o Google Drive agora?')) {
      return;
    }

    try {
      setUploading(true);
      setMessage(null);

      const response = await fetch('/api/maintenance/upload-backup', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar backup ao Google Drive.');
      }

      setMessage({
        type: 'success',
        text: `Backup enviado ao Google Drive com sucesso: ${data.backup.fileName}`,
      });

      await loadGoogleStatus();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao enviar backup ao Google Drive.',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <AuthLayout title="Manutenção do Sistema" requiredRole="ADMIN">
      <div className="space-y-6">
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-900">
          Esta área usa backup real do PostgreSQL com arquivo `.dump`. O envio automático para o Google Drive pode ser usado no cron do Coolify e o envio manual fica disponível abaixo.
        </div>

        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? <FiCheck className="h-4 w-4" /> : <FiX className="h-4 w-4" />}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <FiDatabase className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Backup do banco</h2>
                <p className="text-sm text-gray-500">Dump real do PostgreSQL em formato restaurável</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Baixar backup agora</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Gera um arquivo `.dump` do banco atual para armazenar localmente antes de alterações importantes.
                </p>
                <button
                  onClick={downloadBackup}
                  disabled={downloading}
                  className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloading ? (
                    <>
                      <FiRefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Gerando backup...
                    </>
                  ) : (
                    <>
                      <FiDownload className="mr-2 h-4 w-4" />
                      Baixar backup
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Enviar backup ao Google Drive</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Gera o backup e envia para a pasta de backups do sistema no Google Drive.
                </p>
                <button
                  onClick={uploadBackupToDrive}
                  disabled={uploading || !googleAuth?.authenticated}
                  className="mt-4 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? (
                    <>
                      <FiRefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Enviando ao Drive...
                    </>
                  ) : (
                    <>
                      <FiCloud className="mr-2 h-4 w-4" />
                      Enviar ao Google Drive
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Integração Google</h2>
            <p className="mt-1 text-sm text-gray-500">
              O backup automático depende da autenticação do Google Drive estar válida.
            </p>

            <div className="mt-5 rounded-lg border border-gray-200 p-4">
              {checkingGoogle ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <FiRefreshCw className="h-4 w-4 animate-spin" />
                  Verificando autenticação...
                </div>
              ) : googleAuth?.authenticated ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                    <FiCheck className="h-4 w-4" />
                    Google Drive autenticado
                  </div>
                  <p className="text-sm text-gray-500">
                    O envio manual e o cron já podem usar o Google Drive para armazenar os backups.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                    <FiAlertCircle className="h-4 w-4" />
                    Google Drive não autenticado
                  </div>
                  <p className="text-sm text-gray-500">
                    Configure a integração para habilitar backup manual no Drive e o backup automático do cron.
                  </p>
                  {googleAuth?.authUrl && (
                    <a
                      href={googleAuth.authUrl}
                      className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                    >
                      Configurar Google
                      <FiExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Estratégia recomendada</h3>
              <ul className="mt-2 space-y-2 text-sm text-gray-600">
                <li>Backup manual antes de migrations e mudanças grandes.</li>
                <li>Backup automático diário via cron do Coolify.</li>
                <li>Armazenamento externo no Google Drive.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
