import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTelegramBot } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bot = getTelegramBot();

    if (!bot) {
      return NextResponse.json({ error: 'Bot não configurado' }, { status: 500 });
    }

    const message = body.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id.toString();
    const text = message.text;
    const username = message.from?.username;

    if (text === '/start') {
      const welcomeMessage = `
🤖 <b>Bem-vindo ao Sistema de Notificações de Plantões!</b>

Para receber notificações automáticas sobre seus plantões, você precisa vincular sua conta.

<b>Como vincular:</b>
1. Acesse o sistema web
2. Vá em seu perfil
3. Clique em "Vincular Telegram"
4. Seu código de vinculação será exibido

Ou peça ao administrador para vincular sua conta usando seu @username: <code>${username || 'não definido'}</code>

Seu Chat ID: <code>${chatId}</code>
      `.trim();

      await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
    } else if (text === '/status') {
      const physio = await prisma.physiotherapist.findFirst({
        where: { telegramChatId: chatId },
      });

      if (physio) {
        await bot.sendMessage(
          chatId,
          `✅ Sua conta está vinculada!\n\nNome: ${physio.name}\nVocê receberá notificações sobre seus plantões.`,
          { parse_mode: 'HTML' }
        );
      } else {
        await bot.sendMessage(
          chatId,
          '❌ Sua conta ainda não está vinculada.\n\nUse /start para ver instruções.',
          { parse_mode: 'HTML' }
        );
      }
    } else if (text === '/help') {
      const helpMessage = `
📋 <b>Comandos Disponíveis:</b>

/start - Instruções de vinculação
/status - Verificar status da vinculação
/help - Exibir esta mensagem

<b>Sobre as notificações:</b>
• Você receberá um lembrete 1 dia antes de cada plantão
• Receberá notificação imediata quando um novo plantão for cadastrado
• As notificações são enviadas automaticamente

<b>Dúvidas?</b>
Entre em contato com a gestão do sistema.
      `.trim();

      await bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Erro no webhook do Telegram:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
