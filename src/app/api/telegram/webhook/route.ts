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
      const firstName = message.from?.first_name || 'Usuário';
      
      const welcomeMessage = `
🤖 <b>Bem-vindo ao Sistema de Plantões Furquim!</b>

Olá, ${firstName}! 👋

Para receber notificações de plantões, você precisa vincular sua conta.

📋 <b>Seu Chat ID:</b> <code>${chatId}</code>

📝 <b>Como vincular:</b>
1. <b>Copie</b> o Chat ID acima (toque para copiar)
2. <b>Envie</b> para a Gestora da Furquim Fisioterapia:
   👤 <b>Franciele</b>
   📱 <b>Telefone:</b> 41-99814-9864
3. <b>Aguarde</b> a vinculação ser feita pela gestora

✅ Após a vinculação, você receberá:
• ⚡ Notificação imediata ao ser escalado
• 📅 Lembrete 1 dia antes do plantão

💡 <b>Comandos disponíveis:</b>
• /status - Verificar se está vinculado
• /help - Ver todos os comandos
      `.trim();

      await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
    } else if (text === '/status') {
      const firstName = message.from?.first_name || 'Usuário';
      
      const physio = await prisma.physiotherapist.findFirst({
        where: { telegramChatId: chatId },
        select: {
          id: true,
          name: true,
          telegramUsername: true,
        }
      });

      if (physio) {
        const statusMessage = `
✅ <b>Vinculação Confirmada!</b>

Olá, ${firstName}! 👋

Seu Telegram está vinculado ao sistema:
👤 <b>Nome:</b> ${physio.name}
💬 <b>Chat ID:</b> <code>${chatId}</code>
${physio.telegramUsername ? `📱 <b>Username:</b> @${physio.telegramUsername}` : ''}

🔔 <b>Você receberá notificações:</b>
• ⚡ Imediatas ao ser escalado
• 📅 Lembretes 1 dia antes do plantão

Tudo certo! 🎉
        `.trim();

        await bot.sendMessage(chatId, statusMessage, { parse_mode: 'HTML' });
      } else {
        const notLinkedMessage = `
⚠️ <b>Telegram Não Vinculado</b>

Olá, ${firstName}! 👋

Seu Telegram ainda não está vinculado ao sistema.

📋 <b>Seu Chat ID:</b> <code>${chatId}</code>

📝 <b>Para vincular:</b>
1. <b>Copie</b> o Chat ID acima
2. <b>Envie</b> para a Gestora da Furquim Fisioterapia:
   👤 <b>Franciele</b>
   📱 <b>Telefone:</b> 41-99814-9864
3. <b>Aguarde</b> a vinculação ser feita

Após a vinculação, você receberá notificações automaticamente! ✅
        `.trim();

        await bot.sendMessage(chatId, notLinkedMessage, { parse_mode: 'HTML' });
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
