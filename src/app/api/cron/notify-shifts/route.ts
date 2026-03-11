import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendTelegramMessage,
  formatPeriodName,
  formatDate,
  replacePlaceholders,
  logNotification,
} from '@/lib/telegram';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const settings = await prisma.notificationSettings.findFirst();

    if (!settings || !settings.enabled || !settings.dailyReminderEnabled) {
      return NextResponse.json({
        message: 'Notificações diárias desabilitadas',
        sent: 0,
      });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const shifts = await prisma.shift.findMany({
      where: {
        date: {
          gte: tomorrow,
          lt: dayAfterTomorrow,
        },
      },
      include: {
        physiotherapist: true,
        shiftTeam: true,
      },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const shift of shifts) {
      const { physiotherapist, shiftTeam } = shift;

      if (!physiotherapist.telegramChatId) {
        console.log(`Fisioterapeuta ${physiotherapist.name} não tem Telegram vinculado`);
        continue;
      }

      const message = replacePlaceholders(settings.dailyReminderTemplate, {
        name: physiotherapist.name,
        date: formatDate(shift.date),
        period: formatPeriodName(shift.period),
        team: shiftTeam.name,
      });

      const result = await sendTelegramMessage(physiotherapist.telegramChatId, message);

      if (result.success) {
        sentCount++;
        await logNotification(
          physiotherapist.id,
          shift.id,
          'daily_reminder',
          'sent'
        );
      } else {
        failedCount++;
        await logNotification(
          physiotherapist.id,
          shift.id,
          'daily_reminder',
          'failed',
          result.error
        );
      }
    }

    return NextResponse.json({
      message: 'Notificações processadas',
      total: shifts.length,
      sent: sentCount,
      failed: failedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao processar notificações diárias:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
