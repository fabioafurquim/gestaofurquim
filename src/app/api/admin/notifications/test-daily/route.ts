import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { processDailyShiftNotifications } from '@/lib/notify-shifts';

export async function POST() {
  try {
    const { error } = await requireAdmin();

    if (error) {
      return error;
    }

    const result = await processDailyShiftNotifications();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao testar notificações diárias:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
