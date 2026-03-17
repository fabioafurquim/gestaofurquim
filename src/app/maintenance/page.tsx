'use client';

import { useEffect, useState } from 'react';
import AuthLayout from '@/components/AuthLayout';
import {
  FiAlertCircle,
  FiCheck,
  FiCloud,
  FiDatabase,
  FiDownload,
  FiExternalLink,
  FiHardDrive,
  FiRefreshCw,
  FiUsers,
  FiX,
} from 'react-icons/fi';

type TabId = 'backup' | 'backup-logs' | 'access-logs';

type MessageState = {
  type: 'success' | 'error';
  text: string;
};

type GoogleAuthState = {
  authenticated: boolean;
  authUrl?: string;
};

type BackupLog = {
  id: number;
  triggerType: 'manual_download' | 'manual_drive' | 'cron_drive';
  status: 'success' | 'failed';
  fileName: string | null;
  fileSize: number | null;
  storageTarget: 'local_download' | 'google_drive' | null;
  driveFileId: string | null;
  driveFileName: string | null;
  driveWebViewLink: string | null;
  errorMessage: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
};

type AccessLog = {
  id: number;
  userEmail: string;
  userName: string;
  userRole: 'ADMIN' | 'MANAGER' | 'USER';
  ipAddress: string | null;
  userAgent: string | null;
  loggedInAt: string;
};

const tabOptions: Array<{ id: TabId; label: string; icon: typeof FiDatabase }> = [
  { id: 'backup', label: 'Backup', icon: FiDatabase },
  { id: 'backup-logs', label: 'Logs de Backup', icon: FiHardDrive },
  { id: 'access-logs', label: 'Log de Acessos', icon: FiUsers },
];

const accessRoleLabels: Record<AccessLog['userRole'], string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  USER: 'Fisioterapeuta',
};

const triggerLabels: Record<BackupLog['triggerType'], string> = {
  manual_download: 'Download manual',
  manual_drive: 'Envio manual ao Drive',
  cron_drive: 'Cron automático',
};

const storageLabels: Record<NonNullable<BackupLog['storageTarget']>, string> = {
  local_download: 'Download local',
  google_drive: 'Google Drive',
};

function formatBytes(bytes: number | null) {
  if (!bytes || bytes <= 0) {
    return 'Não informado';
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function MaintenancePage() {
  const [activeTab, setActiveTab] = useState<TabId>('backup');
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthState | null>(null);
  const [checkingGoogle, setCheckingGoogle] = useState(true);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [backupLogsLoading, setBackupLogsLoading] = useState(true);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [accessLogsLoading, setAccessLogsLoading] = useState(true);

  useEffect(() => {
    void loadGoogleStatus();
    void loadBackupLogs();
    void loadAccessLogs();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const requestedTab = new URLSearchParams(window.location.search).get('tab');

    if (requestedTab === 'backup' || requestedTab === 'backup-logs' || requestedTab === 'access-logs') {
      setActiveTab(requestedTab);
    }
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

  const loadBackupLogs = async () => {
    try {
      setBackupLogsLoading(true);
      const response = await fetch('/api/backup-logs?days=30&limit=200');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar logs de backup.');
      }

      setBackupLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao carregar logs de backup.',
      });
    } finally {
      setBackupLogsLoading(false);
    }
  };

  const loadAccessLogs = async () => {
    try {
      setAccessLogsLoading(true);
      const response = await fetch('/api/access-logs?days=30&limit=300');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar log de acessos.');
      }

      setAccessLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao carregar log de acessos.',
      });
    } finally {
      setAccessLogsLoading(false);
    }
  };

  const refreshLogs = async () => {
    await Promise.all([loadBackupLogs(), loadAccessLogs()]);
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

      await loadBackupLogs();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao baixar backup.',
      });

      await loadBackupLogs();
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

      await Promise.all([loadGoogleStatus(), loadBackupLogs()]);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao enviar backup ao Google Drive.',
      });

      await loadBackupLogs();
    } finally {
      setUploading(false);
    }
  };

  return (
    <AuthLayout title="Manutenção do Sistema" requiredRole="ADMIN">
      <div className="space-y-6">
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-900">
          Centralizei aqui as rotinas administrativas mais sensíveis: backup do banco, histórico de execuções e log de acessos.
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

        <div className="flex flex-wrap gap-3">
          {tabOptions.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
                }`}
              >
                <Icon className="mr-2 h-4 w-4" />
                {tab.label}
              </button>
            );
          })}

          {activeTab !== 'backup' && (
            <button
              type="button"
              onClick={() => void refreshLogs()}
              className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
            >
              <FiRefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </button>
          )}
        </div>

        {activeTab === 'backup' && (
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
        )}

        {activeTab === 'backup-logs' && (
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Logs de Backup</h2>
              <p className="text-sm text-gray-500">Execuções manuais e automáticas dos últimos 30 dias.</p>
            </div>

            {backupLogsLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : backupLogs.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                Nenhum log de backup encontrado no período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Data e hora</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Origem</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Arquivo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Destino</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Executado por</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupLogs.map((log) => (
                      <tr key={log.id} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-3 text-sm text-slate-800">
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{triggerLabels[log.triggerType]}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              log.status === 'success'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {log.status === 'success' ? 'Sucesso' : 'Falha'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          <p className="font-medium text-slate-900">{log.fileName || 'Não informado'}</p>
                          <p className="text-slate-500">{formatBytes(log.fileSize)}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {log.storageTarget ? storageLabels[log.storageTarget] : 'Não informado'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {log.createdByName ? (
                            <>
                              <p className="font-medium text-slate-900">{log.createdByName}</p>
                              <p className="text-slate-500">{log.createdByEmail || 'Sem e-mail'}</p>
                            </>
                          ) : (
                            <span className="text-slate-500">Sistema / cron</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {log.driveWebViewLink ? (
                            <a
                              href={log.driveWebViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-blue-600 hover:text-blue-700"
                            >
                              Ver no Drive
                              <FiExternalLink className="ml-1 h-3.5 w-3.5" />
                            </a>
                          ) : log.errorMessage ? (
                            <span>{log.errorMessage}</span>
                          ) : (
                            <span>Sem detalhes adicionais</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'access-logs' && (
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Log de Acessos</h2>
              <p className="text-sm text-gray-500">Logins realizados nos últimos 30 dias.</p>
            </div>

            {accessLogsLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : accessLogs.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                Nenhum acesso registrado no período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Data e hora</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Usuário</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Perfil</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">IP</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Navegador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessLogs.map((log) => (
                      <tr key={log.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-sm text-slate-800">
                          {new Date(log.loggedInAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <p className="font-medium text-slate-900">{log.userName}</p>
                          <p className="text-slate-500">{log.userEmail}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{accessRoleLabels[log.userRole]}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{log.ipAddress || 'Não informado'}</td>
                        <td className="max-w-xs px-4 py-3 text-sm text-slate-500">
                          <span className="line-clamp-2">{log.userAgent || 'Não informado'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
