import { prisma } from '@/lib/prisma';

type BackupLogPayload = {
  triggerType: 'manual_download' | 'manual_drive' | 'cron_drive';
  status: 'success' | 'failed';
  fileName?: string | null;
  fileSize?: number | null;
  storageTarget?: 'local_download' | 'google_drive' | null;
  driveFileId?: string | null;
  driveFileName?: string | null;
  driveWebViewLink?: string | null;
  errorMessage?: string | null;
  createdByUserId?: number | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
};

export async function createBackupLog(payload: BackupLogPayload) {
  return prisma.backupLog.create({
    data: {
      triggerType: payload.triggerType,
      status: payload.status,
      fileName: payload.fileName ?? null,
      fileSize: payload.fileSize ?? null,
      storageTarget: payload.storageTarget ?? null,
      driveFileId: payload.driveFileId ?? null,
      driveFileName: payload.driveFileName ?? null,
      driveWebViewLink: payload.driveWebViewLink ?? null,
      errorMessage: payload.errorMessage ?? null,
      createdByUserId: payload.createdByUserId ?? null,
      createdByName: payload.createdByName ?? null,
      createdByEmail: payload.createdByEmail ?? null,
    },
  });
}
