import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores.' },
        { status: 403 }
      );
    }

    // Buscar fisioterapeutas com Telegram vinculado
    const physiotherapists = await prisma.physiotherapist.findMany({
      where: {
        telegramChatId: { not: null },
      },
      select: {
        id: true,
        name: true,
        telegramChatId: true,
      },
    });

    if (physiotherapists.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum fisioterapeuta com Telegram vinculado encontrado' },
        { status: 400 }
      );
    }

    const message = `
🧪 <b>Mensagem de Teste</b>

Olá! Esta é uma mensagem de teste do Sistema de Plantões Furquim.

Se você recebeu esta mensagem, significa que:
✅ Seu Telegram está vinculado corretamente
✅ O bot está funcionando
✅ Você receberá notificações de plantões

<i>Teste realizado em ${new Date().toLocaleString('pt-BR')}</i>
    `.trim();

    let sentCount = 0;
    const errors: string[] = [];

    for (const physio of physiotherapists) {
      const result = await sendTelegramMessage(physio.telegramChatId!, message);
      if (result.success) {
        sentCount++;
      } else {
        errors.push(`${physio.name}: ${result.error}`);
      }
    }

    return NextResponse.json({
      message: 'Teste concluído',
      sentTo: sentCount,
      total: physiotherapists.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Erro ao testar bot:', error);
    return NextResponse.json(
      { error: 'Erro ao testar bot', details: error.message },
      { status: 500 }
    );
  }
}
