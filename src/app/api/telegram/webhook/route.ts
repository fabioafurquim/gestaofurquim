import { NextRequest, NextResponse } from 'next/server';
import type TelegramBot from 'node-telegram-bot-api';
import { prisma } from '@/lib/prisma';
import { getTelegramBot } from '@/lib/telegram';

const TELEGRAM_MESSAGE_LIMIT = 3800;

const PERIOD_NAMES: Record<string, string> = {
  MORNING: '🌅 Manhã',
  INTERMEDIATE: '☀️ Intermediário',
  AFTERNOON: '🌤️ Tarde',
  NIGHT: '🌙 Noite'
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getCommand(text?: string): string | null {
  if (!text) {
    return null;
  }

  const firstToken = text.trim().split(/\s+/)[0];
  if (!firstToken.startsWith('/')) {
    return null;
  }

  return firstToken.toLowerCase().replace(/@[\w_]+$/, '');
}

function splitTelegramMessage(message: string, maxLength = TELEGRAM_MESSAGE_LIMIT): string[] {
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks: string[] = [];
  const sections = message.split('\n\n');
  let currentChunk = '';

  for (const section of sections) {
    const candidate = currentChunk ? `${currentChunk}\n\n${section}` : section;
    if (candidate.length <= maxLength) {
      currentChunk = candidate;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
      currentChunk = '';
    }

    if (section.length <= maxLength) {
      currentChunk = section;
      continue;
    }

    const lines = section.split('\n');
    let currentLineChunk = '';

    for (const line of lines) {
      const lineCandidate = currentLineChunk ? `${currentLineChunk}\n${line}` : line;
      if (lineCandidate.length <= maxLength) {
        currentLineChunk = lineCandidate;
        continue;
      }

      if (currentLineChunk) {
        chunks.push(currentLineChunk);
      }

      currentLineChunk = line;
    }

    if (currentLineChunk) {
      currentChunk = currentLineChunk;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function sendHtmlMessage(
  bot: TelegramBot,
  chatId: string,
  message: string
): Promise<void> {
  for (const chunk of splitTelegramMessage(message)) {
    await bot.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
  }
}

async function findPhysioByChatId(chatId: string) {
  return prisma.physiotherapist.findFirst({
    where: { telegramChatId: chatId },
    select: { id: true, name: true }
  });
}

async function findFutureShifts(physiotherapistId: number, fromDate: Date) {
  return prisma.shift.findMany({
    where: {
      physiotherapistId,
      date: { gte: fromDate }
    },
    include: { shiftTeam: true },
    orderBy: { date: 'asc' }
  });
}

async function findPastShiftDates(physiotherapistId: number, beforeDate: Date) {
  return prisma.shift.findMany({
    where: {
      physiotherapistId,
      date: { lt: beforeDate }
    },
    select: { date: true },
    orderBy: { date: 'desc' }
  });
}

async function findMonthShifts(physiotherapistId: number, startDate: Date, endDate: Date) {
  return prisma.shift.findMany({
    where: {
      physiotherapistId,
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    include: { shiftTeam: true },
    orderBy: { date: 'asc' }
  });
}

function buildShiftDetailsMessage(
  title: string,
  shifts: Array<{ date: Date; period: string; shiftTeam: { name: string } }>
): string {
  let message = `📅 <b>${escapeTelegramHtml(title)}</b>\n\n`;
  message += `Total: <b>${shifts.length}</b> plantão(ões)\n\n`;

  shifts.forEach((shift, index) => {
    const shiftDate = new Date(shift.date);
    const dateStr = shiftDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const periodName = PERIOD_NAMES[shift.period] || shift.period;

    message += `${index + 1}. <b>${escapeTelegramHtml(dateStr)}</b>\n`;
    message += `   ${escapeTelegramHtml(periodName)}\n`;
    message += `   🏥 ${escapeTelegramHtml(shift.shiftTeam.name)}\n\n`;
  });

  return message.trim();
}

function buildMonthSelectionMessage(
  months: Array<{ month: number; year: number; count: number }>
): string {
  let message = '📋 <b>Plantões Realizados - Selecione o Mês</b>\n\n';
  message += 'Você possui plantões realizados nos seguintes meses:\n\n';

  months.forEach((monthData, index) => {
    message += `${index + 1}. <b>${MONTH_NAMES[monthData.month]}/${monthData.year}</b> - ${monthData.count} plantão(ões)\n`;
  });

  message += '\n💡 <b>Clique no botão do mês desejado:</b>';
  return message;
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
      console.log('[Telegram Webhook] Recebido:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('[Telegram Webhook] Erro ao parsear JSON:', parseError);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    
    const bot = getTelegramBot();

    if (!bot) {
      console.error('[Telegram Webhook] Bot não configurado');
      return NextResponse.json({ error: 'Bot não configurado' }, { status: 500 });
    }

    // Handler para callback_query (cliques nos botões)
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message.chat.id.toString();
      const data = callbackQuery.data;

      // Responder ao callback para remover o loading
      await bot.answerCallbackQuery(callbackQuery.id);

      // Processar clique no botão de mês
      if (typeof data === 'string' && data.startsWith('month_')) {
        const [_, year, month] = data.split('_');
        const monthNum = parseInt(month) - 1;
        const yearNum = parseInt(year);

        const physio = await findPhysioByChatId(chatId);

        if (!physio) {
          await sendHtmlMessage(bot, chatId, '⚠️ Você precisa estar vinculado ao sistema.');
          return NextResponse.json({ ok: true });
        }

        const startDate = new Date(yearNum, monthNum, 1);
        const endDate = new Date(yearNum, monthNum + 1, 0, 23, 59, 59);
        const monthShifts = await findMonthShifts(physio.id, startDate, endDate);

        if (monthShifts.length === 0) {
          await sendHtmlMessage(
            bot,
            chatId,
            `📋 Nenhum plantão encontrado em ${MONTH_NAMES[monthNum]}/${yearNum}.`
          );
          return NextResponse.json({ ok: true });
        }

        const monthMessage = buildShiftDetailsMessage(
          `Plantões Realizados - ${MONTH_NAMES[monthNum]}/${yearNum}`,
          monthShifts
        );

        await sendHtmlMessage(bot, chatId, monthMessage);
      }

      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id.toString();
    const text = message.text;
    const command = getCommand(text);
    const username = message.from?.username;

    console.log('[Webhook] ========== MENSAGEM RECEBIDA ==========');
    console.log('[Webhook] ChatId:', chatId);
    console.log('[Webhook] Username:', username);
    console.log('[Webhook] Text:', JSON.stringify(text));
    console.log('[Webhook] Text Type:', typeof text);
    console.log('[Webhook] Text Length:', text ? text.length : 0);
    console.log('[Webhook] Message completa:', JSON.stringify(message, null, 2));
    console.log('[Webhook] ==========================================');

    if (command === '/start') {
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
    } else if (command === '/status') {
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
      return NextResponse.json({ ok: true });
    } else if (command === '/teste') {
      await bot.sendMessage(chatId, '✅ Comando /teste funcionando!', { parse_mode: 'HTML' });
      return NextResponse.json({ ok: true });
    } else if (command === '/shifts' || command === '/plantoes') {
      console.log('[/shifts] COMANDO RECEBIDO! ChatId:', chatId);
      
      const physio = await findPhysioByChatId(chatId);

      if (!physio) {
        await sendHtmlMessage(bot, chatId, '⚠️ Você precisa estar vinculado ao sistema. Use /start');
        return NextResponse.json({ ok: true });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const futureShifts = await findFutureShifts(physio.id, today);

      if (futureShifts.length === 0) {
        await sendHtmlMessage(bot, chatId, '📅 Você não possui plantões agendados.');
        return NextResponse.json({ ok: true });
      }

      const futureMessage = buildShiftDetailsMessage('Seus Plantões Futuros', futureShifts);
      await sendHtmlMessage(bot, chatId, futureMessage);
      return NextResponse.json({ ok: true });
    } else if (command === '/history' || command === '/plantoesrealizados') {
      try {
        console.log('[/plantoesrealizados] Comando recebido de chatId:', chatId);
        
        const physio = await findPhysioByChatId(chatId);
        
        console.log('[/plantoesrealizados] Fisioterapeuta encontrado:', physio ? physio.name : 'Nenhum');

        if (!physio) {
          await sendHtmlMessage(
            bot,
            chatId,
            '⚠️ Você precisa estar vinculado ao sistema para usar este comando. Use /start para instruções.'
          );
          return NextResponse.json({ ok: true });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pastShifts = await findPastShiftDates(physio.id, today);

        if (pastShifts.length === 0) {
          await sendHtmlMessage(bot, chatId, '📋 Você ainda não possui plantões realizados no histórico.');
          return NextResponse.json({ ok: true });
        }

        const monthsWithShifts = new Map<string, { month: number; year: number; count: number }>();
        
        pastShifts.forEach(shift => {
          const shiftDate = new Date(shift.date);
          const month = shiftDate.getMonth();
          const year = shiftDate.getFullYear();
          const key = `${year}-${String(month + 1).padStart(2, '0')}`;
          
          if (monthsWithShifts.has(key)) {
            monthsWithShifts.get(key)!.count++;
          } else {
            monthsWithShifts.set(key, { month, year, count: 1 });
          }
        });

        const sortedMonths = Array.from(monthsWithShifts.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([, data]) => data);

        // Criar botões inline (máximo 2 por linha)
        const buttons = [];
        for (let i = 0; i < sortedMonths.length; i += 2) {
          const row = [];
          
          const data1 = sortedMonths[i];
          const monthName1 = MONTH_NAMES[data1.month];
          row.push({
            text: `${monthName1}/${data1.year}`,
            callback_data: `month_${data1.year}_${String(data1.month + 1).padStart(2, '0')}`
          });

          if (i + 1 < sortedMonths.length) {
            const data2 = sortedMonths[i + 1];
            const monthName2 = MONTH_NAMES[data2.month];
            row.push({
              text: `${monthName2}/${data2.year}`,
              callback_data: `month_${data2.year}_${String(data2.month + 1).padStart(2, '0')}`
            });
          }

          buttons.push(row);
        }

        const messageText = buildMonthSelectionMessage(sortedMonths);

        await bot.sendMessage(chatId, messageText, { 
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: buttons
          }
        });
        return NextResponse.json({ ok: true });
      } catch (error) {
        console.error('[/plantoesrealizados] ERRO:', error);
        await sendHtmlMessage(bot, chatId, '❌ Erro ao processar comando /plantoesrealizados. Tente novamente.');
        return NextResponse.json({ ok: true });
      }
    } else if (command === '/help') {
      const helpMessage = `
📋 <b>Comandos Disponíveis:</b>

/start - Instruções de vinculação
/status - Verificar status da vinculação
/plantoes - Ver seus plantões futuros
/plantoesrealizados - Ver histórico de plantões
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
    console.error('[Telegram Webhook] Erro:', error);
    console.error('[Telegram Webhook] Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json({ error: 'Erro interno', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
}
