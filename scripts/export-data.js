const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient()

async function exportData() {
  console.log('=== Exportando dados do banco local ===')
  console.log('')
  
  try {
    console.log('Buscando usuários...')
    const users = await prisma.user.findMany()
    
    console.log('Buscando fisioterapeutas...')
    const physiotherapists = await prisma.physiotherapist.findMany()
    
    console.log('Buscando equipes...')
    const shiftTeams = await prisma.shiftTeam.findMany()
    
    console.log('Buscando plantões...')
    const shifts = await prisma.shift.findMany()
    
    const data = {
      users,
      physiotherapists,
      shiftTeams,
      shifts,
      exportedAt: new Date().toISOString(),
      totalRecords: users.length + physiotherapists.length + shiftTeams.length + shifts.length
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const filename = `backup_${timestamp}.json`
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2))
    
    console.log('')
    console.log('✅ Backup criado com sucesso!')
    console.log(`Arquivo: ${filename}`)
    console.log(`Tamanho: ${(fs.statSync(filename).size / 1024).toFixed(2)} KB`)
    console.log('')
    console.log('Estatísticas:')
    console.log(`  - Usuários: ${users.length}`)
    console.log(`  - Fisioterapeutas: ${physiotherapists.length}`)
    console.log(`  - Equipes: ${shiftTeams.length}`)
    console.log(`  - Plantões: ${shifts.length}`)
    console.log(`  - Total: ${data.totalRecords} registros`)
    console.log('')
    console.log('Próximo passo: Transfira o arquivo para produção e importe')
    
  } catch (error) {
    console.error('❌ Erro ao exportar dados:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

exportData()
