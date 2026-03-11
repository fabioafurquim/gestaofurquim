require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSettings() {
  try {
    console.log('🔍 Verificando configurações de notificação...\n');

    const settings = await prisma.notificationSettings.findFirst();

    if (!settings) {
      console.log('❌ Nenhuma configuração encontrada no banco!');
      console.log('📝 Criando configurações padrão...\n');
      
      const newSettings = await prisma.notificationSettings.create({
        data: {
          enabled: true,
          dailyReminderEnabled: true,
          instantNotificationEnabled: true,
          dailyReminderTemplate: '🔔 Lembrete de Plantão\n\nOlá {{name}}!\n\nVocê tem um plantão amanhã:\n📅 Data: {{date}}\n⏰ Período: {{period}}\n🏥 Equipe: {{team}}\n\nBoa sorte! 💪',
          instantNotificationTemplate: '⚡ Novo Plantão Agendado!\n\nOlá {{name}}!\n\nVocê foi escalado para um plantão:\n📅 Data: {{date}}\n⏰ Período: {{period}}\n🏥 Equipe: {{team}}\n\nFique atento! 👍',
        },
      });
      
      console.log('✅ Configurações criadas com sucesso!');
      console.log(newSettings);
    } else {
      console.log('📋 Configurações encontradas:');
      console.log('- Notificações habilitadas:', settings.enabled ? '✅ SIM' : '❌ NÃO');
      console.log('- Lembretes diários:', settings.dailyReminderEnabled ? '✅ SIM' : '❌ NÃO');
      console.log('- Notificações instantâneas:', settings.instantNotificationEnabled ? '✅ SIM' : '❌ NÃO');
      console.log('\n📝 Template de notificação instantânea:');
      console.log(settings.instantNotificationTemplate);
    }

    console.log('\n🔍 Verificando TELEGRAM_BOT_TOKEN...');
    if (process.env.TELEGRAM_BOT_TOKEN) {
      console.log('✅ Token configurado');
    } else {
      console.log('❌ Token NÃO configurado no .env');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSettings();
