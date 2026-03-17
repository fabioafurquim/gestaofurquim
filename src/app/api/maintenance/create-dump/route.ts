import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { createBackupLog } from '@/lib/backup-logs';
import { createDatabaseBackup } from '@/lib/database-backup';

export async function POST() {
  const { error, user } = await requireAdmin();
  if (error) return error;

  try {
    const backup = await createDatabaseBackup();

    await createBackupLog({
      triggerType: 'manual_download',
      status: 'success',
      fileName: backup.fileName,
      fileSize: backup.size,
      storageTarget: 'local_download',
      createdByUserId: typeof user?.id === 'string' ? parseInt(user.id, 10) : user?.id,
      createdByName: user?.name || null,
      createdByEmail: user?.email || null,
    });

    return new NextResponse(Buffer.from(backup.buffer), {
      status: 200,
      headers: {
        'Content-Type': backup.mimeType,
        'Content-Disposition': `attachment; filename="${backup.fileName}"`,
        'Content-Length': String(backup.size),
        'Cache-Control': 'no-store',
        'X-Backup-Created-At': backup.createdAt,
      },
    });
  } catch (createError) {
    console.error('Erro ao criar backup do PostgreSQL:', createError);

    const message =
      createError instanceof Error
        ? createError.message
        : 'Erro interno do servidor ao criar backup';

    await createBackupLog({
      triggerType: 'manual_download',
      status: 'failed',
      storageTarget: 'local_download',
      errorMessage: message,
      createdByUserId: typeof user?.id === 'string' ? parseInt(user.id, 10) : user?.id,
      createdByName: user?.name || null,
      createdByEmail: user?.email || null,
    }).catch((logError) => {
      console.error('Erro ao registrar falha de backup manual:', logError);
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
