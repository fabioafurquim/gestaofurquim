import { NextRequest, NextResponse } from 'next/server';
import { processDailyShiftNotifications } from '@/lib/notify-shifts';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const result = await processDailyShiftNotifications();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao processar notificações diárias:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
