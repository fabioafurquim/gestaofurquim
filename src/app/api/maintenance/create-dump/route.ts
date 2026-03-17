import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { createDatabaseBackup } from '@/lib/database-backup';

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const backup = await createDatabaseBackup();

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

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
