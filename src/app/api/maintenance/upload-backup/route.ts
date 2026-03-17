import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { createBackupLog } from '@/lib/backup-logs';
import { createDatabaseBackup, uploadDatabaseBackupToDrive } from '@/lib/database-backup';
import { isAuthenticated } from '@/lib/google-drive';

export async function POST() {
  const { error, user } = await requireAdmin();
  if (error) return error;

  if (!isAuthenticated()) {
    return NextResponse.json(
      { error: 'Google Drive não está autenticado. Configure a integração antes de enviar backups.' },
      { status: 400 }
    );
  }

  try {
    const backup = await createDatabaseBackup();
    const driveResult = await uploadDatabaseBackupToDrive(backup);

    await createBackupLog({
      triggerType: 'manual_drive',
      status: 'success',
      fileName: backup.fileName,
      fileSize: backup.size,
      storageTarget: 'google_drive',
      driveFileId: driveResult.fileId,
      driveFileName: driveResult.fileName,
      driveWebViewLink: driveResult.webViewLink,
      createdByUserId: typeof user?.id === 'string' ? parseInt(user.id, 10) : user?.id,
      createdByName: user?.name || null,
      createdByEmail: user?.email || null,
    });

    return NextResponse.json({
      message: 'Backup enviado ao Google Drive com sucesso.',
      backup: {
        fileName: backup.fileName,
        size: backup.size,
        createdAt: backup.createdAt,
      },
      drive: driveResult,
    });
  } catch (uploadError) {
    console.error('Erro ao enviar backup ao Google Drive:', uploadError);

    const message =
      uploadError instanceof Error
        ? uploadError.message
        : 'Erro interno do servidor ao enviar backup';

    await createBackupLog({
      triggerType: 'manual_drive',
      status: 'failed',
      storageTarget: 'google_drive',
      errorMessage: message,
      createdByUserId: typeof user?.id === 'string' ? parseInt(user.id, 10) : user?.id,
      createdByName: user?.name || null,
      createdByEmail: user?.email || null,
    }).catch((logError) => {
      console.error('Erro ao registrar falha de backup no Drive:', logError);
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
