import { spawn } from 'child_process';
import { uploadBufferToDrive } from '@/lib/google-drive';

const BACKUP_MIME_TYPE = 'application/octet-stream';
const DEFAULT_DRIVE_ROOT = 'backup_gestaofurquim';

type DatabaseConnectionConfig = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  sslMode?: string;
};

export type DatabaseBackupArtifact = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

function parseDatabaseConnection() {
  const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error('DATABASE_URL não configurada.');
  }

  const parsedUrl = new URL(rawUrl);
  const database = parsedUrl.pathname.replace(/^\//, '');

  if (!database) {
    throw new Error('Não foi possível identificar o banco na DATABASE_URL.');
  }

  return {
    host: parsedUrl.hostname,
    port: parsedUrl.port || '5432',
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database,
    sslMode: parsedUrl.searchParams.get('sslmode') || undefined,
  } satisfies DatabaseConnectionConfig;
}

function formatTimestamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

function buildBackupFileName(date: Date) {
  return `plantaofisio-postgres-${formatTimestamp(date)}.dump`;
}

export async function createDatabaseBackup(): Promise<DatabaseBackupArtifact> {
  const createdAt = new Date();
  const config = parseDatabaseConnection();
  const fileName = buildBackupFileName(createdAt);
  const pgDumpBinary = process.env.PG_DUMP_BINARY || 'pg_dump';

  const args = [
    '--format=custom',
    '--compress=9',
    '--no-owner',
    '--no-privileges',
    '--host',
    config.host,
    '--port',
    config.port,
    '--username',
    config.user,
    '--dbname',
    config.database,
  ];

  const output = await new Promise<Buffer>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const child = spawn(pgDumpBinary, args, {
      env: {
        ...process.env,
        PGPASSWORD: config.password,
        ...(config.sslMode ? { PGSSLMODE: config.sslMode } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('pg_dump não está disponível no ambiente atual.'));
        return;
      }

      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim();
        reject(new Error(stderr || `pg_dump finalizou com código ${code}.`));
        return;
      }

      resolve(Buffer.concat(stdoutChunks));
    });
  });

  return {
    buffer: output,
    fileName,
    mimeType: BACKUP_MIME_TYPE,
    size: output.byteLength,
    createdAt: createdAt.toISOString(),
  };
}

export async function uploadDatabaseBackupToDrive(artifact: DatabaseBackupArtifact) {
  const createdAt = new Date(artifact.createdAt);
  const year = String(createdAt.getFullYear());
  const month = String(createdAt.getMonth() + 1).padStart(2, '0');
  const folderNames = [DEFAULT_DRIVE_ROOT, year, `${year}-${month}`];

  return uploadBufferToDrive(
    artifact.buffer,
    artifact.fileName,
    artifact.mimeType,
    folderNames
  );
}
