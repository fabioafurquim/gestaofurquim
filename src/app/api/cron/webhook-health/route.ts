import { NextRequest, NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/telegram/webhook`;

    if (!token) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN não configurado' },
        { status: 500 }
      );
    }

    const bot = new TelegramBot(token, { polling: false });

    // Verificar status do webhook
    const webhookInfo = await bot.getWebHookInfo();

    let fixed = false;
    let message = '';

    // Se webhook não está configurado ou URL está errada
    if (!webhookInfo.url || webhookInfo.url !== webhookUrl) {
      console.log('⚠️ Webhook não configurado ou URL incorreta. Reconfigurando...');
      
      // Deletar webhook antigo (se existir)
      if (webhookInfo.url) {
        await bot.deleteWebHook();
      }

      // Configurar webhook correto
      await bot.setWebHook(webhookUrl);
      
      fixed = true;
      message = `Webhook reconfigurado automaticamente. URL: ${webhookUrl}`;
      
      console.log('✅ Webhook reconfigurado com sucesso!');
    } else {
      message = `Webhook OK. URL: ${webhookInfo.url}, Pending: ${webhookInfo.pending_update_count}`;
      console.log('✅ Webhook está funcionando corretamente');
    }

    // Verificar se há erros recentes
    if (webhookInfo.last_error_message) {
      console.warn('⚠️ Último erro do webhook:', webhookInfo.last_error_message);
      
      // Se erro foi recente (últimas 2 horas), reconfigurar
      const twoHoursAgo = Math.floor(Date.now() / 1000) - (2 * 60 * 60);
      if (webhookInfo.last_error_date && webhookInfo.last_error_date > twoHoursAgo) {
        console.log('🔧 Erro recente detectado. Reconfigurando webhook...');
        await bot.deleteWebHook();
        await bot.setWebHook(webhookUrl);
        fixed = true;
        message += ` | Reconfigurado devido a erro recente: ${webhookInfo.last_error_message}`;
      }
    }

    return NextResponse.json({
      status: 'ok',
      webhook: {
        url: webhookInfo.url,
        configured: !!webhookInfo.url,
        pending_updates: webhookInfo.pending_update_count,
        last_error: webhookInfo.last_error_message || null,
        last_error_date: webhookInfo.last_error_date || null,
      },
      fixed,
      message,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Erro no health check do webhook:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao verificar webhook', 
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
