/**
 * Script para popular histórico de preços com valores atuais
 * Deve ser executado uma única vez após criar as tabelas de histórico
 * 
 * Uso: npx ts-node scripts/populate-price-history.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando população do histórico de preços...\n');

  try {
    // 1. Popular histórico de valores de equipes
    console.log('📋 Buscando equipes com valores configurados...');
    const teams = await prisma.shiftTeam.findMany({
      where: {
        shiftValue: {
          gt: 0,
        },
      },
    });

    console.log(`✓ Encontradas ${teams.length} equipes com valores\n`);

    for (const team of teams) {
      // Verificar se já existe histórico
      const existingHistory = await prisma.shiftTeamPriceHistory.findFirst({
        where: { shiftTeamId: team.id },
      });

      if (!existingHistory) {
        // Criar registro histórico com data retroativa (1 ano atrás)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        await prisma.shiftTeamPriceHistory.create({
          data: {
            shiftTeamId: team.id,
            shiftValue: team.shiftValue,
            effectiveFrom: oneYearAgo,
            createdBy: null, // Sistema
          },
        });

        console.log(`  ✓ Equipe "${team.name}": R$ ${team.shiftValue} (desde ${oneYearAgo.toLocaleDateString('pt-BR')})`);
      } else {
        console.log(`  ⊘ Equipe "${team.name}": já possui histórico`);
      }
    }

    console.log('\n📋 Buscando fisioterapeutas com valores customizados...');
    
    // 2. Popular histórico de valores customizados
    const physioTeams = await prisma.physiotherapistTeam.findMany({
      where: {
        customShiftValue: {
          not: null,
        },
      },
      include: {
        physiotherapist: {
          select: { name: true },
        },
        shiftTeam: {
          select: { name: true },
        },
      },
    });

    console.log(`✓ Encontrados ${physioTeams.length} vínculos com valores customizados\n`);

    for (const physioTeam of physioTeams) {
      // Verificar se já existe histórico
      const existingHistory = await prisma.physiotherapistTeamPriceHistory.findFirst({
        where: { physiotherapistTeamId: physioTeam.id },
      });

      if (!existingHistory && physioTeam.customShiftValue) {
        // Criar registro histórico com data retroativa (1 ano atrás)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        await prisma.physiotherapistTeamPriceHistory.create({
          data: {
            physiotherapistTeamId: physioTeam.id,
            customShiftValue: physioTeam.customShiftValue,
            effectiveFrom: oneYearAgo,
            createdBy: null, // Sistema
          },
        });

        console.log(`  ✓ ${physioTeam.physiotherapist.name} @ ${physioTeam.shiftTeam.name}: R$ ${physioTeam.customShiftValue}`);
      } else if (existingHistory) {
        console.log(`  ⊘ ${physioTeam.physiotherapist.name} @ ${physioTeam.shiftTeam.name}: já possui histórico`);
      }
    }

    console.log('\n✅ População do histórico concluída com sucesso!');
    console.log('\n📊 Resumo:');
    
    const teamHistoryCount = await prisma.shiftTeamPriceHistory.count();
    const physioTeamHistoryCount = await prisma.physiotherapistTeamPriceHistory.count();
    
    console.log(`  - Registros de histórico de equipes: ${teamHistoryCount}`);
    console.log(`  - Registros de histórico de valores customizados: ${physioTeamHistoryCount}`);
    
  } catch (error) {
    console.error('❌ Erro ao popular histórico:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
