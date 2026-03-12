import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTelegramBot } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Telegram Webhook] Recebido:', JSON.stringify(body, null, 2));
    
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
      const messageId = callbackQuery.message.message_id;

      // Responder ao callback para remover o loading
      await bot.answerCallbackQuery(callbackQuery.id);

      // Processar clique no botão de mês
      if (data.startsWith('month_')) {
        const [_, year, month] = data.split('_');
        const monthNum = parseInt(month) - 1;
        const yearNum = parseInt(year);

        const physio = await prisma.physiotherapist.findFirst({
          where: { telegramChatId: chatId },
          select: { id: true, name: true }
        });

        if (!physio) {
          await bot.sendMessage(chatId, '⚠️ Você precisa estar vinculado ao sistema.');
          return NextResponse.json({ ok: true });
        }

        const startDate = new Date(yearNum, monthNum, 1);
        const endDate = new Date(yearNum, monthNum + 1, 0, 23, 59, 59);

        const monthShifts = await prisma.shift.findMany({
          where: {
            physiotherapistId: physio.id,
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          include: {
            shiftTeam: true
          },
          orderBy: { date: 'asc' }
        });

        const periodNames: Record<string, string> = {
          MORNING: '🌅 Manhã',
          INTERMEDIATE: '☀️ Intermediário',
          AFTERNOON: '🌤️ Tarde',
          NIGHT: '🌙 Noite'
        };

        const monthNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];

        let message = `📋 <b>Plantões Realizados - ${monthNames[monthNum]}/${yearNum}</b>\n\n`;
        message += `Total: <b>${monthShifts.length}</b> plantão(ões)\n\n`;

        monthShifts.forEach((shift, index) => {
          const shiftDate = new Date(shift.date);
          const dateStr = shiftDate.toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            day: '2-digit', 
            month: '2-digit'
          });
          const periodName = periodNames[shift.period] || shift.period;
          
          message += `${index + 1}. <b>${dateStr}</b>\n`;
          message += `   ${periodName}\n`;
          message += `   🏥 ${shift.shiftTeam.name}\n\n`;
        });

        // Editar a mensagem original com os resultados
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML'
        });
      }

      return NextResponse.json({ ok: true });
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
    } else if (text === '/plantoes') {
      console.log('[/plantoes] Comando recebido de chatId:', chatId);
      
      const physio = await prisma.physiotherapist.findFirst({
        where: { telegramChatId: chatId },
        select: { id: true, name: true }
      });
      
      console.log('[/plantoes] Fisioterapeuta encontrado:', physio ? physio.name : 'Nenhum');

      if (!physio) {
        await bot.sendMessage(chatId, '⚠️ Você precisa estar vinculado ao sistema para usar este comando. Use /start para instruções.', { parse_mode: 'HTML' });
        return NextResponse.json({ ok: true });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const futureShifts = await prisma.shift.findMany({
        where: {
          physiotherapistId: physio.id,
          date: { gte: today }
        },
        include: {
          shiftTeam: true
        },
        orderBy: { date: 'asc' }
      });

      if (futureShifts.length === 0) {
        await bot.sendMessage(chatId, '📅 Você não possui plantões agendados a partir de hoje.', { parse_mode: 'HTML' });
        return NextResponse.json({ ok: true });
      }

      const periodNames: Record<string, string> = {
        MORNING: '🌅 Manhã',
        INTERMEDIATE: '☀️ Intermediário',
        AFTERNOON: '🌤️ Tarde',
        NIGHT: '🌙 Noite'
      };

      let message = `📅 <b>Seus Plantões Futuros</b>\n\n`;
      message += `Total: <b>${futureShifts.length}</b> plantão(ões)\n\n`;

      futureShifts.forEach((shift, index) => {
        const shiftDate = new Date(shift.date);
        const dateStr = shiftDate.toLocaleDateString('pt-BR', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        const periodName = periodNames[shift.period] || shift.period;
        
        message += `${index + 1}. <b>${dateStr}</b>\n`;
        message += `   ${periodName}\n`;
        message += `   🏥 ${shift.shiftTeam.name}\n\n`;
      });

      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } else if (text === '/plantoesrealizados') {
      console.log('[/plantoesrealizados] Comando recebido de chatId:', chatId);
      
      const physio = await prisma.physiotherapist.findFirst({
        where: { telegramChatId: chatId },
        select: { id: true, name: true }
      });
      
      console.log('[/plantoesrealizados] Fisioterapeuta encontrado:', physio ? physio.name : 'Nenhum');

      if (!physio) {
        await bot.sendMessage(chatId, '⚠️ Você precisa estar vinculado ao sistema para usar este comando. Use /start para instruções.', { parse_mode: 'HTML' });
        return NextResponse.json({ ok: true });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pastShifts = await prisma.shift.findMany({
        where: {
          physiotherapistId: physio.id,
          date: { lt: today }
        },
        select: { date: true },
        orderBy: { date: 'desc' }
      });

      if (pastShifts.length === 0) {
        await bot.sendMessage(chatId, '📋 Você ainda não possui plantões realizados no histórico.', { parse_mode: 'HTML' });
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

      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];

      let messageText = `📋 <b>Plantões Realizados - Selecione o Mês</b>\n\n`;
      messageText += `Você possui plantões realizados nos seguintes meses:\n\n`;

      const sortedMonths = Array.from(monthsWithShifts.entries())
        .sort((a, b) => b[0].localeCompare(a[0]));

      sortedMonths.forEach(([key, data], index) => {
        const monthName = monthNames[data.month];
        messageText += `${index + 1}. <b>${monthName}/${data.year}</b> - ${data.count} plantão(ões)\n`;
      });

      messageText += `\n💡 <b>Clique no botão do mês desejado:</b>`;

      // Criar botões inline (máximo 2 por linha)
      const buttons = [];
      for (let i = 0; i < sortedMonths.length; i += 2) {
        const row = [];
        
        const [key1, data1] = sortedMonths[i];
        const monthName1 = monthNames[data1.month];
        row.push({
          text: `${monthName1}/${data1.year}`,
          callback_data: `month_${data1.year}_${String(data1.month + 1).padStart(2, '0')}`
        });

        if (i + 1 < sortedMonths.length) {
          const [key2, data2] = sortedMonths[i + 1];
          const monthName2 = monthNames[data2.month];
          row.push({
            text: `${monthName2}/${data2.year}`,
            callback_data: `month_${data2.year}_${String(data2.month + 1).padStart(2, '0')}`
          });
        }

        buttons.push(row);
      }

      await bot.sendMessage(chatId, messageText, { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: buttons
        }
      });
    } else if (text === '/help') {
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
