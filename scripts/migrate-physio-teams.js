const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migratePhysiotherapistTeams() {
  console.log('🔄 Iniciando migração de dados dos fisioterapeutas...');
  
  try {
    // 1. Buscar todos os fisioterapeutas com suas equipes atuais
    const physiotherapists = await prisma.physiotherapist.findMany({
      select: {
        id: true,
        name: true,
        shiftTeamId: true,
        shiftValue: true
      }
    });
    
    console.log(`📊 Encontrados ${physiotherapists.length} fisioterapeutas para migrar`);
    
    // 2. Criar backup dos dados atuais
    const backupData = {
      physiotherapists: physiotherapists,
      timestamp: new Date().toISOString()
    };
    
    console.log('💾 Dados de backup:', JSON.stringify(backupData, null, 2));
    
    // 3. Salvar informações importantes para a migração
    const migrationData = physiotherapists
      .filter(p => p.shiftTeamId) // Apenas fisioterapeutas com equipe
      .map(p => ({
        physiotherapistId: p.id,
        shiftTeamId: p.shiftTeamId,
        hourValue: p.shiftValue // O valor atual será migrado para hourValue
      }));
    
    console.log('📋 Dados para migração:', migrationData);
    console.log(`✅ Preparação concluída. ${migrationData.length} relações serão criadas após a migração do schema.`);
    
    return migrationData;
    
  } catch (error) {
    console.error('❌ Erro durante a preparação da migração:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  migratePhysiotherapistTeams()
    .then((data) => {
      console.log('🎉 Preparação da migração concluída com sucesso!');
      console.log('📝 Próximos passos:');
      console.log('1. Executar a migração do Prisma');
      console.log('2. Executar o script de pós-migração para recriar as relações');
    })
    .catch((error) => {
      console.error('💥 Falha na preparação da migração:', error);
      process.exit(1);
    });
}

module.exports = { migratePhysiotherapistTeams };