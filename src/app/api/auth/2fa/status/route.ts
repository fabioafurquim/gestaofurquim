import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getTwoFactorCookieNames, getTwoFactorStatus } from '@/lib/two-factor';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const userId =
    typeof session.user.id === 'string' ? parseInt(session.user.id, 10) : session.user.id;
  const cookieNames = getTwoFactorCookieNames();
  const status = await getTwoFactorStatus(
    userId,
    request.cookies.get(cookieNames.verified)?.value,
    request.cookies.get(cookieNames.trustedDevice)?.value,
  );

  return NextResponse.json({
    mustChangePassword: session.user.mustChangePassword,
    isFirstLogin: session.user.isFirstLogin,
    role: session.user.role,
    twoFactor: status,
  });
}
