require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPhysios() {
  try {
    console.log('🔍 Verificando fisioterapeutas com Telegram vinculado...\n');

    const physios = await prisma.physiotherapist.findMany({
      where: {
        telegramChatId: { not: null }
      },
      select: {
        id: true,
        name: true,
        telegramChatId: true,
        telegramUsername: true,
      }
    });

    if (physios.length === 0) {
      console.log('❌ Nenhum fisioterapeuta com Telegram vinculado encontrado!');
    } else {
      console.log(`✅ ${physios.length} fisioterapeuta(s) com Telegram vinculado:\n`);
      physios.forEach(p => {
        console.log(`👤 ${p.name}`);
        console.log(`   ID: ${p.id}`);
        console.log(`   Chat ID: ${p.telegramChatId}`);
        console.log(`   Username: ${p.telegramUsername || 'não informado'}`);
        console.log('');
      });
    }

    console.log('\n🔍 Verificando plantões recentes...\n');
    
    const recentShifts = await prisma.shift.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        physiotherapist: {
          select: {
            name: true,
            telegramChatId: true,
          }
        },
        shiftTeam: {
          select: {
            name: true,
          }
        }
      }
    });

    if (recentShifts.length > 0) {
      console.log('📋 Últimos 5 plantões criados:\n');
      recentShifts.forEach((shift, idx) => {
        console.log(`${idx + 1}. ${shift.physiotherapist.name} - ${shift.date.toLocaleDateString('pt-BR')}`);
        console.log(`   Equipe: ${shift.shiftTeam.name}`);
        console.log(`   Período: ${shift.period}`);
        console.log(`   Telegram: ${shift.physiotherapist.telegramChatId ? '✅ Vinculado' : '❌ Não vinculado'}`);
        console.log(`   Criado em: ${shift.createdAt.toLocaleString('pt-BR')}`);
        console.log('');
      });
    }

    console.log('\n🔍 Verificando logs de notificação...\n');
    
    const logs = await prisma.notificationLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 5,
      include: {
        physiotherapist: {
          select: { name: true }
        }
      }
    });

    if (logs.length === 0) {
      console.log('❌ Nenhum log de notificação encontrado!');
    } else {
      console.log(`📋 Últimos ${logs.length} logs de notificação:\n`);
      logs.forEach((log, idx) => {
        const statusIcon = log.status === 'sent' ? '✅' : log.status === 'failed' ? '❌' : '⏳';
        console.log(`${idx + 1}. ${statusIcon} ${log.physiotherapist.name}`);
        console.log(`   Tipo: ${log.messageType}`);
        console.log(`   Status: ${log.status}`);
        console.log(`   Data: ${log.sentAt.toLocaleString('pt-BR')}`);
        if (log.errorMessage) {
          console.log(`   Erro: ${log.errorMessage}`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPhysios();
