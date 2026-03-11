import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import TelegramBot from 'node-telegram-bot-api';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { action } = body;

    const bot = new TelegramBot(token, { polling: false });

    if (action === 'set') {
      // Configurar webhook
      const webhookUrl = `${process.env.NEXTAUTH_URL}/api/telegram/webhook`;
      
      await bot.setWebHook(webhookUrl);

      return NextResponse.json({
        message: 'Webhook configurado com sucesso',
        url: webhookUrl,
      });
    } else if (action === 'delete') {
      // Remover webhook
      await bot.deleteWebHook();

      return NextResponse.json({
        message: 'Webhook removido com sucesso',
      });
    } else {
      return NextResponse.json(
        { error: 'Ação inválida. Use "set" ou "delete"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Erro ao gerenciar webhook:', error);
    return NextResponse.json(
      { error: 'Erro ao gerenciar webhook', details: error.message },
      { status: 500 }
    );
  }
}
