import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { revokeTrustedDevice } from '@/lib/two-factor';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await params;
  const deviceId = parseInt(id, 10);

  if (Number.isNaN(deviceId)) {
    return NextResponse.json({ error: 'Dispositivo inválido.' }, { status: 400 });
  }

  const userId =
    typeof session.user.id === 'string' ? parseInt(session.user.id, 10) : session.user.id;

  await revokeTrustedDevice(userId, deviceId);

  return NextResponse.json({ message: 'Dispositivo confiável revogado com sucesso.' });
}
