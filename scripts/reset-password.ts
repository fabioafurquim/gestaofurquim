import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPassword() {
  const email = 'fabiofurquim@gmail.com';
  const newPassword = 'Admin123'; // Altere para a senha que você quer
  
  try {
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
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Nova senha: ${newPassword}`);
    console.log(`👤 Usuário: ${user.name}`);
    console.log('\n⚠️  IMPORTANTE: Altere a senha após fazer login!');
  } catch (error) {
    console.error('❌ Erro ao resetar senha:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
