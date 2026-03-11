/**
 * Script de Polling do Telegram para Desenvolvimento
 * 
 * Em desenvolvimento, o webhook não funciona porque localhost não é acessível pela internet.
 * Este script usa polling para buscar mensagens do Telegram.
 * 
 * USO:
 * node scripts/telegram-polling.js
 */

const TelegramBot = require('node-telegram-bot-api');

// Carrega variáveis de ambiente
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN não encontrado no .env');
  process.exit(1);
}

console.log('🤖 Iniciando bot Telegram em modo POLLING...');
console.log('📡 Aguardando mensagens...\n');

// Cria bot com polling
const bot = new TelegramBot(token, { polling: true });

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || 'sem username';
  const firstName = msg.from.first_name || '';

  console.log(`✅ /start recebido de ${firstName} (@${username})`);
  console.log(`   Chat ID: ${chatId}\n`);

  const message = `
🤖 *Bem-vindo ao Sistema de Plantões Furquim!*

Olá, ${firstName}! 👋

Para receber notificações de plantões, você precisa vincular sua conta.

📋 *Seu Chat ID:* \`${chatId}\`

📝 *Como vincular:*
1. *Copie* o Chat ID acima (toque para copiar)
2. *Envie* para a Gestora da Furquim Fisioterapia:
   👤 *Franciele*
   📱 *Telefone:* 41-99814-9864
3. *Aguarde* a vinculação ser feita pela gestora

✅ Após a vinculação, você receberá:
• ⚡ Notificação imediata ao ser escalado
• 📅 Lembrete 1 dia antes do plantão

💡 *Comandos disponíveis:*
• /status - Verificar se está vinculado
• /help - Ver todos os comandos
  `.trim();

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Comando /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || 'sem username';
  const firstName = msg.from.first_name || 'Usuário';

  console.log(`✅ /status recebido de @${username} (Chat ID: ${chatId})`);

  try {
    // Conectar ao banco para verificar vinculação
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const physiotherapist = await prisma.physiotherapist.findFirst({
      where: { telegramChatId: chatId.toString() },
      select: {
        id: true,
        name: true,
        telegramUsername: true,
      }
    });

    await prisma.$disconnect();

    if (physiotherapist) {
      const message = `
✅ *Vinculação Confirmada!*

Olá, ${firstName}! 👋

Seu Telegram está vinculado ao sistema:
👤 *Nome:* ${physiotherapist.name}
💬 *Chat ID:* \`${chatId}\`
${physiotherapist.telegramUsername ? `📱 *Username:* @${physiotherapist.telegramUsername}` : ''}

🔔 *Você receberá notificações:*
• ⚡ Imediatas ao ser escalado
• 📅 Lembretes 1 dia antes do plantão

Tudo certo! 🎉
      `.trim();

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } else {
      const message = `
⚠️ *Telegram Não Vinculado*

Olá, ${firstName}! 👋

Seu Telegram ainda não está vinculado ao sistema.

📋 *Seu Chat ID:* \`${chatId}\`

📝 *Para vincular:*
1. *Copie* o Chat ID acima
2. *Envie* para a Gestora da Furquim Fisioterapia:
   👤 *Franciele*
   📱 *Telefone:* 41-99814-9864
3. *Aguarde* a vinculação ser feita

Após a vinculação, você receberá notificações automaticamente! ✅
      `.trim();

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    bot.sendMessage(chatId, '❌ Erro ao verificar status. Tente novamente mais tarde.');
  }
});

// Comando /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  console.log(`❓ /help recebido`);

  const message = `
📚 *Comandos Disponíveis*

/start - Iniciar e obter Chat ID
/status - Verificar status da vinculação
/help - Mostrar esta mensagem

💡 *Dica:* Após vincular sua conta, você receberá notificações automáticas de plantões!
  `.trim();

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Mensagens genéricas
bot.on('message', (msg) => {
  // Ignora comandos (já tratados acima)
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }

  const chatId = msg.chat.id;
  
  console.log(`💬 Mensagem recebida: "${msg.text}"`);

  bot.sendMessage(chatId, 
    'Olá! Use /start para começar ou /help para ver os comandos disponíveis.',
    { parse_mode: 'Markdown' }
  );
});

// Tratamento de erros
bot.on('polling_error', (error) => {
  console.error('❌ Erro no polling:', error.message);
});

console.log('✅ Bot iniciado com sucesso!');
console.log('🔄 Modo: POLLING (desenvolvimento)');
console.log('⌨️  Pressione Ctrl+C para parar\n');
