import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { createDatabaseBackup, uploadDatabaseBackupToDrive } from '@/lib/database-backup';
import { isAuthenticated } from '@/lib/google-drive';

export async function POST() {
  const { error } = await requireAdmin();
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

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
