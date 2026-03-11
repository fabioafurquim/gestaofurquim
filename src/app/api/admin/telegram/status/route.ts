import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import TelegramBot from 'node-telegram-bot-api';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      );
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN não configurado' },
        { status: 500 }
      );
    }

    const bot = new TelegramBot(token, { polling: false });

    // Buscar informações do bot
    const botInfo = await bot.getMe();

    // Buscar informações do webhook
    const webhookInfo = await bot.getWebHookInfo();

    return NextResponse.json({
      bot: botInfo,
      webhook: webhookInfo,
    });
  } catch (error: any) {
    console.error('Erro ao buscar status do Telegram:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar status do Telegram', details: error.message },
      { status: 500 }
    );
  }
}
