import { prisma } from './prisma';
import {
  sendTelegramMessage,
  formatPeriodName,
  formatDate,
  replacePlaceholders,
  logNotification,
} from './telegram';

export async function sendInstantNotification(shiftId: number): Promise<void> {
  try {
    const settings = await prisma.notificationSettings.findFirst();

    if (!settings || !settings.enabled || !settings.instantNotificationEnabled) {
      console.log('Notificações instantâneas desabilitadas');
      return;
    }

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        physiotherapist: true,
        shiftTeam: true,
      },
    });

    if (!shift) {
      console.error('Plantão não encontrado:', shiftId);
      return;
    }

    const { physiotherapist, shiftTeam } = shift;

    if (!physiotherapist.telegramChatId) {
      console.log(`Fisioterapeuta ${physiotherapist.name} não tem Telegram vinculado`);
      return;
    }

    const message = replacePlaceholders(settings.instantNotificationTemplate, {
      name: physiotherapist.name,
      date: formatDate(shift.date),
      period: formatPeriodName(shift.period),
      team: shiftTeam.name,
    });

    const result = await sendTelegramMessage(physiotherapist.telegramChatId, message);

    if (result.success) {
      await logNotification(
        physiotherapist.id,
        shift.id,
        'instant_notification',
        'sent'
      );
      console.log(`Notificação enviada para ${physiotherapist.name}`);
    } else {
      await logNotification(
        physiotherapist.id,
        shift.id,
        'instant_notification',
        'failed',
        result.error
      );
      console.error(`Falha ao enviar notificação para ${physiotherapist.name}:`, result.error);
    }
  } catch (error) {
    console.error('Erro ao enviar notificação instantânea:', error);
  }
}
