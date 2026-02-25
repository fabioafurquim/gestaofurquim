const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

/**
 * Cria um backup automático completo do banco de dados
 * @param {string} operation - Descrição da operação que será realizada
 * @returns {Promise<string>} - Caminho do arquivo de backup criado
 */
async function createAutoBackup(operation = 'schema-change') {
  try {
    console.log('🔄 Iniciando backup automático antes da operação:', operation);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDir = path.join(__dirname, '..', 'backups');
    
    // Criar diretório de backups se não existir
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const fileName = `auto-backup-${operation}-${timestamp}.json`;
    const filePath = path.join(backupDir, fileName);
    
    // Buscar todos os dados
    console.log('📊 Coletando dados do banco...');
    
    const [shiftTeams, physiotherapists, users, shifts, physiotherapistTeams] = await Promise.all([
      prisma.shiftTeam.findMany({
        orderBy: { id: 'asc' }
      }),
      prisma.physiotherapist.findMany({
        orderBy: { id: 'asc' }
      }),
      prisma.user.findMany({
        orderBy: { id: 'asc' }
      }),
      prisma.shift.findMany({
        orderBy: { id: 'asc' }
      }),
      prisma.physiotherapistTeam.findMany({
        orderBy: { id: 'asc' }
      })
    ]);
    
    // Criar estrutura do backup
    const backupData = {
      metadata: {
        version: '1.0',
        created_at: new Date().toISOString(),
        operation: operation,
        database_url: process.env.DATABASE_URL ? 'configured' : 'not_configured'
      },
      counts: {
        shiftTeams: shiftTeams.length,
        physiotherapists: physiotherapists.length,
        users: users.length,
        shifts: shifts.length,
        physiotherapistTeams: physiotherapistTeams.length
      },
      data: {
        shiftTeams,
        physiotherapists,
        users: users.map(user => ({
          ...user,
          password: '[REDACTED]' // Não incluir senhas no backup por segurança
        })),
        shifts,
        physiotherapistTeams
      }
    };
    
    // Salvar backup
    const jsonData = JSON.stringify(backupData, null, 2);
    fs.writeFileSync(filePath, jsonData, 'utf8');
    
    const fileSize = (fs.statSync(filePath).size / 1024).toFixed(2);
    
    console.log(`✅ Backup criado com sucesso: ${fileName}`);
    console.log(`📁 Localização: ${filePath}`);
    console.log(`📊 Tamanho: ${fileSize} KB`);
    console.log(`📈 Dados salvos: ${backupData.counts.shiftTeams} equipes, ${backupData.counts.physiotherapists} fisioterapeutas, ${backupData.counts.users} usuários, ${backupData.counts.shifts} plantões`);
    
    return filePath;
    
  } catch (error) {
    console.error('❌ Erro ao criar backup automático:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Verifica se há dados no banco antes de operações destrutivas
 * @returns {Promise<boolean>} - true se há dados importantes
 */
async function hasImportantData() {
  try {
    const [userCount, physioCount, shiftCount] = await Promise.all([
      prisma.user.count(),
      prisma.physiotherapist.count(),
      prisma.shift.count()
    ]);
    
    return userCount > 0 || physioCount > 0 || shiftCount > 0;
  } catch (error) {
    console.warn('⚠️ Não foi possível verificar dados existentes:', error.message);
    return true; // Assumir que há dados por segurança
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Executa backup automático se necessário antes de operações no schema
 * @param {string} operation - Descrição da operação
 * @returns {Promise<string|null>} - Caminho do backup ou null se não foi necessário
 */
async function safeSchemaOperation(operation) {
  const hasData = await hasImportantData();
  
  if (hasData) {
    console.log('⚠️ Dados importantes detectados no banco!');
    console.log('🔒 Criando backup de segurança antes da operação...');
    return await createAutoBackup(operation);
  } else {
    console.log('ℹ️ Nenhum dado importante detectado, prosseguindo sem backup.');
    return null;
  }
}

module.exports = {
  createAutoBackup,
  hasImportantData,
  safeSchemaOperation
};

// Permitir execução direta do script
if (require.main === module) {
  const operation = process.argv[2] || 'manual-backup';
  
  createAutoBackup(operation)
    .then((filePath) => {
      console.log('✅ Backup concluído:', filePath);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Falha no backup:', error);
      process.exit(1);
    });
}