import { UserRole } from '@prisma/client';
import { prisma } from './prisma';
import { formatDate, formatPeriodName, sendTelegramMessage } from './telegram';

function formatRole(role: UserRole): string {
  if (role === 'ADMIN') return 'Administrador';
  if (role === 'MANAGER') return 'Gestor';
  return 'Fisioterapeuta';
}

export async function notifyManagersAboutShiftDeletion(logId: number): Promise<void> {
  const settings = await prisma.notificationSettings.findFirst();

  if (!settings || !settings.enabled || !settings.shiftDeletionTelegramEnabled) {
    return;
  }

  const log = await prisma.shiftDeletionLog.findUnique({
    where: { id: logId },
  });

  if (!log) {
    return;
  }

  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'MANAGER'] },
      physiotherapist: {
        telegramChatId: { not: null },
      },
    },
    select: {
      name: true,
      role: true,
      physiotherapist: {
        select: {
          telegramChatId: true,
        },
      },
    },
  });

  const uniqueRecipients = Array.from(
    new Map(
      recipients
        .filter((recipient) => recipient.physiotherapist?.telegramChatId)
        .map((recipient) => [
          recipient.physiotherapist!.telegramChatId!,
          {
            chatId: recipient.physiotherapist!.telegramChatId!,
            name: recipient.name,
            role: recipient.role,
          },
        ])
    ).values()
  );

  if (uniqueRecipients.length === 0) {
    await prisma.shiftDeletionLog.update({
      where: { id: logId },
      data: {
        notificationError: 'Nenhum gestor ou administrador com Telegram vinculado.',
      },
    });
    return;
  }

  const message = [
    '🚨 <b>Exclusão de Plantão</b>',
    '',
    `${log.deletedByUserName} (${formatRole(log.deletedByUserRole)}) removeu um plantão do calendário.`,
    '',
    `<b>Fisioterapeuta:</b> ${log.physiotherapistName}`,
    `<b>Data:</b> ${formatDate(log.shiftDate)}`,
    `<b>Período:</b> ${formatPeriodName(log.period)}`,
    `<b>Equipe:</b> ${log.shiftTeamName}`,
    `<b>Excluído em:</b> ${new Date(log.createdAt).toLocaleString('pt-BR')}`,
  ].join('\n');

  const results = await Promise.all(
    uniqueRecipients.map(async (recipient) => {
      const result = await sendTelegramMessage(recipient.chatId, message);
      return {
        recipient,
        result,
      };
    })
  );

  const sentRecipients = results
    .filter(({ result }) => result.success)
    .map(({ recipient }) => `${recipient.name} (${formatRole(recipient.role)})`);

  const failedRecipients = results
    .filter(({ result }) => !result.success)
    .map(({ recipient, result }) => `${recipient.name}: ${result.error ?? 'Erro ao enviar'}`);

  await prisma.shiftDeletionLog.update({
    where: { id: logId },
    data: {
      notifiedViaTelegram: sentRecipients.length > 0,
      notificationSentAt: sentRecipients.length > 0 ? new Date() : null,
      notificationTargets: sentRecipients.length > 0 ? sentRecipients.join(', ') : null,
      notificationError: failedRecipients.length > 0 ? failedRecipients.join(' | ') : null,
    },
  });
}
