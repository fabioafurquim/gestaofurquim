import { NextRequest, NextResponse } from 'next/server';
import { createBackupLog } from '@/lib/backup-logs';
import { createDatabaseBackup, uploadDatabaseBackupToDrive } from '@/lib/database-backup';
import { isAuthenticated } from '@/lib/google-drive';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!(await isAuthenticated())) {
      return NextResponse.json(
        { error: 'Google Drive não está autenticado para receber backups automáticos.' },
        { status: 500 }
      );
    }

    const backup = await createDatabaseBackup();
    const drive = await uploadDatabaseBackupToDrive(backup);

    await createBackupLog({
      triggerType: 'cron_drive',
      status: 'success',
      fileName: backup.fileName,
      fileSize: backup.size,
      storageTarget: 'google_drive',
      driveFileId: drive.fileId,
      driveFileName: drive.fileName,
      driveWebViewLink: drive.webViewLink,
    });

    return NextResponse.json({
      message: 'Backup automático concluído com sucesso.',
      backup: {
        fileName: backup.fileName,
        size: backup.size,
        createdAt: backup.createdAt,
      },
      drive,
      timestamp: new Date().toISOString(),
    });
  } catch (backupError) {
    console.error('Erro no backup automático do banco:', backupError);

    const message =
      backupError instanceof Error
        ? backupError.message
        : 'Erro interno do servidor';

    await createBackupLog({
      triggerType: 'cron_drive',
      status: 'failed',
      storageTarget: 'google_drive',
      errorMessage: message,
    }).catch((logError) => {
      console.error('Erro ao registrar falha do cron de backup:', logError);
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
