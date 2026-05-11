import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { listTrustedDevices } from '@/lib/two-factor';

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const userId =
    typeof session.user.id === 'string' ? parseInt(session.user.id, 10) : session.user.id;
  const devices = await listTrustedDevices(userId);

  return NextResponse.json({ devices });
}
