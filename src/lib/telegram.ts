import TelegramBot from 'node-telegram-bot-api';
import { prisma } from './prisma';

let bot: TelegramBot | null = null;

export function getTelegramBot(): TelegramBot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN não configurado');
    return null;
  }

  if (!bot) {
    bot = new TelegramBot(token, { polling: false });
  }

  return bot;
}

export async function sendTelegramMessage(
  chatId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const bot = getTelegramBot();
    
    if (!bot) {
      return { success: false, error: 'Bot não configurado' };
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    return { success: true };
  } catch (error: any) {
    console.error('Erro ao enviar mensagem Telegram:', error);
    return { success: false, error: error.message };
  }
}

export function formatPeriodName(period: string): string {
  const periods: Record<string, string> = {
    MORNING: 'Manhã (07:00 - 13:00)',
    INTERMEDIATE: 'Intermediário (13:00 - 19:00)',
    AFTERNOON: 'Tarde (13:00 - 19:00)',
    NIGHT: 'Noite (19:00 - 07:00)',
  };
  return periods[period] || period;
}

export function formatDate(date: Date): string {
  const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const d = new Date(date);
  const dayName = weekdays[d.getDay()];
  const formatted = d.toLocaleDateString('pt-BR');
  return `${formatted} (${dayName})`;
}

export function replacePlaceholders(
  template: string,
  data: {
    name: string;
    date: string;
    period: string;
    team: string;
  }
): string {
  return template
    .replace(/\{\{name\}\}/g, data.name)
    .replace(/\{\{date\}\}/g, data.date)
    .replace(/\{\{period\}\}/g, data.period)
    .replace(/\{\{team\}\}/g, data.team);
}

export async function logNotification(
  physiotherapistId: number,
  shiftId: number | null,
  messageType: 'daily_reminder' | 'instant_notification',
  status: 'sent' | 'failed' | 'pending',
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.notificationLog.create({
      data: {
        physiotherapistId,
        shiftId,
        messageType,
        status,
        platform: 'telegram',
        errorMessage,
      },
    });
  } catch (error) {
    console.error('Erro ao registrar log de notificação:', error);
  }
}
