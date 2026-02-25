#!/usr/bin/env node

const { execSync } = require('child_process');
const { safeSchemaOperation, hasImportantData } = require('./auto-backup');
const readline = require('readline');

/**
 * Comandos do Prisma que são considerados destrutivos
 */
const DESTRUCTIVE_COMMANDS = [
  'migrate reset',
  'db push --force-reset',
  'migrate reset --force',
  'db execute'
];

/**
 * Comandos que modificam o schema e precisam de backup
 */
const SCHEMA_COMMANDS = [
  'migrate dev',
  'migrate deploy',
  'db push',
  'migrate reset'
];

/**
 * Solicita confirmação do usuário para operações destrutivas
 * @param {string} command - Comando a ser executado
 * @returns {Promise<boolean>} - true se o usuário confirmar
 */
function askConfirmation(command) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\n⚠️  ATENÇÃO: OPERAÇÃO DESTRUTIVA DETECTADA!');
    console.log(`📋 Comando: npx prisma ${command}`);
    console.log('🚨 Este comando pode causar PERDA DE DADOS!');
    console.log('');
    
    rl.question('Tem certeza que deseja continuar? (digite "CONFIRMO" para prosseguir): ', (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'CONFIRMO');
    });
  });
}

/**
 * Executa comando do Prisma com segurança
 * @param {string[]} args - Argumentos do comando prisma
 */
async function safePrismaCommand(args) {
  try {
    const command = args.join(' ');
    console.log(`🔧 Executando: npx prisma ${command}`);
    
    // Verificar se é comando destrutivo
    const isDestructive = DESTRUCTIVE_COMMANDS.some(destructiveCmd => 
      command.includes(destructiveCmd)
    );
    
    // Verificar se modifica schema
    const modifiesSchema = SCHEMA_COMMANDS.some(schemaCmd => 
      command.includes(schemaCmd)
    );
    
    // Se é destrutivo, solicitar confirmação
    if (isDestructive) {
      const hasData = await hasImportantData();
      
      if (hasData) {
        const confirmed = await askConfirmation(command);
        if (!confirmed) {
          console.log('❌ Operação cancelada pelo usuário.');
          process.exit(1);
        }
      }
    }
    
    // Se modifica schema, fazer backup automático
    if (modifiesSchema) {
      const backupPath = await safeSchemaOperation(command.replace(/\s+/g, '-'));
      if (backupPath) {
        console.log(`✅ Backup de segurança criado: ${backupPath}`);
      }
    }
    
    // Executar comando original
    console.log(`\n🚀 Executando comando Prisma...`);
    execSync(`npx prisma ${command}`, { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    console.log('✅ Comando executado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao executar comando Prisma:', error.message);
    process.exit(1);
  }
}

// Processar argumentos da linha de comando
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('📋 Uso: node safe-prisma.js <comando-prisma>');
  console.log('📋 Exemplo: node safe-prisma.js migrate dev');
  console.log('📋 Exemplo: node safe-prisma.js migrate reset --force');
  process.exit(1);
}

// Executar comando
safePrismaCommand(args);