const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

async function testMigration() {
  console.log('🔍 Testando sistema de migração automática...');
  
  const prisma = new PrismaClient();
  
  try {
    // Tenta verificar se as tabelas existem
    console.log('📊 Verificando se tabelas existem...');
    const userCount = await prisma.user.count();
    console.log(`✅ Tabela User existe. Total de usuários: ${userCount}`);
    
  } catch (error) {
    if (error.code === 'P2021') {
      console.log('❌ Tabela User não existe. Executando migrações...');
      
      try {
        console.log('🔄 Executando prisma migrate deploy...');
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
        
        console.log('🔄 Executando prisma generate...');
        execSync('npx prisma generate', { stdio: 'inherit' });
        
        console.log('✅ Migrações executadas com sucesso!');
        
        // Testa novamente
        const newUserCount = await prisma.user.count();
        console.log(`✅ Tabela User criada. Total de usuários: ${newUserCount}`);
        
      } catch (migrationError) {
        console.error('❌ Erro ao executar migrações:', migrationError.message);
        throw migrationError;
      }
    } else {
      console.error('❌ Erro inesperado:', error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

testMigration()
  .then(() => {
    console.log('🎉 Teste de migração concluído com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Falha no teste de migração:', error.message);
    process.exit(1);
  });