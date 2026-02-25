const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  console.log('Tentando inicializar o Prisma Client...');
  console.log('Lendo DATABASE_URL do process.env:', process.env.DATABASE_URL);

  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('Conectando ao banco de dados...');
    await prisma.$connect();
    console.log('✅ Conexão com o banco de dados bem-sucedida!');
    
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('Versão do PostgreSQL:', result);

  } catch (error) {
    console.error('❌ Erro ao conectar com o banco de dados:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Desconectado do banco de dados.');
  }
}

testConnection();