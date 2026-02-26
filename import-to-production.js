const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient()

async function importData() {
  console.log('=== Importando dados em produção ===')
  console.log('')
  
  try {
    const data = JSON.parse(fs.readFileSync('/app/backup.json', 'utf8'))
    
    console.log('Backup de:', data.exportedAt)
    console.log('Total:', data.totalRecords, 'registros')
    console.log('')
    
    // Limpar dados (ordem importa por causa das foreign keys)
    console.log('Limpando dados existentes...')
    await prisma.shift.deleteMany()
    await prisma.physiotherapistTeam.deleteMany()
    await prisma.user.deleteMany()
    await prisma.physiotherapist.deleteMany()
    await prisma.shiftTeam.deleteMany()
    console.log('✅ Dados limpos')
    console.log('')
    
    // Importar na ordem correta
    console.log('Importando', data.users.length, 'usuários...')
    for (const user of data.users) {
      await prisma.user.create({ data: user })
    }
    console.log('✅ Usuários importados')
    
    console.log('Importando', data.physiotherapists.length, 'fisioterapeutas...')
    for (const physio of data.physiotherapists) {
      await prisma.physiotherapist.create({ data: physio })
    }
    console.log('✅ Fisioterapeutas importados')
    
    console.log('Importando', data.shiftTeams.length, 'equipes...')
    for (const team of data.shiftTeams) {
      await prisma.shiftTeam.create({ data: team })
    }
    console.log('✅ Equipes importadas')
    
    console.log('Importando', data.shifts.length, 'plantões...')
    for (const shift of data.shifts) {
      await prisma.shift.create({ data: shift })
    }
    console.log('✅ Plantões importados')
    
    console.log('')
    console.log('🎉 Importação concluída com sucesso!')
    console.log('')
    console.log('Resumo:')
    console.log('  - Usuários:', data.users.length)
    console.log('  - Fisioterapeutas:', data.physiotherapists.length)
    console.log('  - Equipes:', data.shiftTeams.length)
    console.log('  - Plantões:', data.shifts.length)
    
  } catch (error) {
    console.error('❌ Erro ao importar:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

importData()
