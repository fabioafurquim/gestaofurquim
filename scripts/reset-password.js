const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetPassword() {
  const email = 'fabiofurquim@gmail.com';
  const newPassword = 'Admin123';
  
  try {
    console.log('=== Resetando senha em produção ===');
    console.log('');
    
    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Atualizar usuário
    const user = await prisma.user.update({
      where: { email },
      data: { 
        password: hashedPassword,
        mustChangePassword: false,
        isFirstLogin: false
      },
    });
    
    console.log('✅ Senha resetada com sucesso!');
    console.log('');
    console.log('Credenciais:');
    console.log(`  📧 Email: ${email}`);
    console.log(`  🔑 Senha: ${newPassword}`);
    console.log(`  👤 Nome: ${user.name}`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere a senha após fazer login!');
    
  } catch (error) {
    console.error('❌ Erro ao resetar senha:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
