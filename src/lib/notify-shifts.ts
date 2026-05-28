import { prisma } from '@/lib/prisma';
import {
  sendTelegramMessage,
  formatPeriodName,
  formatDate,
  replacePlaceholders,
  logNotification,
} from '@/lib/telegram';

export interface DailyShiftNotificationResult {
  message: string;
  total: number;
  sent: number;
  failed: number;
  timestamp: string;
}

export async function processDailyShiftNotifications(): Promise<DailyShiftNotificationResult> {
  const settings = await prisma.notificationSettings.findFirst();

  if (!settings || !settings.enabled || !settings.dailyReminderEnabled) {
    return {
      message: 'Notificações diárias desabilitadas',
      total: 0,
      sent: 0,
      failed: 0,
      timestamp: new Date().toISOString(),
    };
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

  return {
    message: 'Notificações processadas',
    total: shifts.length,
    sent: sentCount,
    failed: failedCount,
    timestamp: new Date().toISOString(),
  };
}
