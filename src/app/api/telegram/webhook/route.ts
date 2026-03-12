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
    } else if (text === '/plantoes') {
      const physio = await prisma.physiotherapist.findFirst({
        where: { telegramChatId: chatId },
        select: { id: true, name: true }
      });

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
      const physio = await prisma.physiotherapist.findFirst({
        where: { telegramChatId: chatId },
        select: { id: true, name: true }
      });

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

      let message = `📋 <b>Plantões Realizados - Selecione o Mês</b>\n\n`;
      message += `Você possui plantões realizados nos seguintes meses:\n\n`;

      const sortedMonths = Array.from(monthsWithShifts.entries())
        .sort((a, b) => b[0].localeCompare(a[0]));

      sortedMonths.forEach(([key, data], index) => {
        const monthName = monthNames[data.month];
        message += `${index + 1}. <b>${monthName}/${data.year}</b> - ${data.count} plantão(ões)\n`;
      });

      message += `\n💡 <b>Para ver os detalhes:</b>\n`;
      message += `Digite: <code>/mes MM/AAAA</code>\n`;
      message += `Exemplo: <code>/mes 03/2026</code>`;

      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } else if (text?.startsWith('/mes ')) {
      const physio = await prisma.physiotherapist.findFirst({
        where: { telegramChatId: chatId },
        select: { id: true, name: true }
      });

      if (!physio) {
        await bot.sendMessage(chatId, '⚠️ Você precisa estar vinculado ao sistema para usar este comando.', { parse_mode: 'HTML' });
        return NextResponse.json({ ok: true });
      }

      const monthYearStr = text.replace('/mes ', '').trim();
      const match = monthYearStr.match(/^(\d{2})\/(\d{4})$/);

      if (!match) {
        await bot.sendMessage(chatId, '❌ Formato inválido. Use: <code>/mes MM/AAAA</code>\nExemplo: <code>/mes 03/2026</code>', { parse_mode: 'HTML' });
        return NextResponse.json({ ok: true });
      }

      const month = parseInt(match[1]) - 1;
      const year = parseInt(match[2]);

      if (month < 0 || month > 11) {
        await bot.sendMessage(chatId, '❌ Mês inválido. Use um valor entre 01 e 12.', { parse_mode: 'HTML' });
        return NextResponse.json({ ok: true });
      }

      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59);

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

      if (monthShifts.length === 0) {
        const monthNames = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        await bot.sendMessage(chatId, `📋 Nenhum plantão encontrado em ${monthNames[month]}/${year}.`, { parse_mode: 'HTML' });
        return NextResponse.json({ ok: true });
      }

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

      let message = `📋 <b>Plantões Realizados - ${monthNames[month]}/${year}</b>\n\n`;
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

      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
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
    console.error('Erro no webhook do Telegram:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
