#!/bin/bash
# Script para importar dados em produção
# Execute no servidor: bash import-data-production.sh backup_2026-02-26.json

if [ -z "$1" ]; then
    echo "❌ Erro: Especifique o arquivo de backup"
    echo "Uso: bash import-data-production.sh backup_2026-02-26.json"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Arquivo não encontrado: $BACKUP_FILE"
    exit 1
fi

echo "=== Importando dados em produção ==="
echo ""
echo "Arquivo: $BACKUP_FILE"
echo ""
echo "⚠️  ATENÇÃO: Isso vai SUBSTITUIR todos os dados em produção!"
echo "Pressione ENTER para continuar ou CTRL+C para cancelar..."
read

# Container da aplicação
APP_CONTAINER=$(docker ps -q --filter "name=g48wk8goo88g8k8cw4cs484g")

if [ -z "$APP_CONTAINER" ]; then
    echo "❌ Container da aplicação não encontrado!"
    exit 1
fi

echo "Container: $APP_CONTAINER"
echo ""

# Copiar arquivo para o container
echo "Copiando arquivo para o container..."
docker cp "$BACKUP_FILE" "$APP_CONTAINER:/tmp/backup.json"

# Criar script de importação
cat > /tmp/import-script.js << 'EOF'
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient()

async function importData() {
  console.log('=== Importando dados ===')
  console.log('')
  
  try {
    const data = JSON.parse(fs.readFileSync('/tmp/backup.json', 'utf8'))
    
    console.log(`Backup de: ${data.exportedAt}`)
    console.log(`Total de registros: ${data.totalRecords}`)
    console.log('')
    
    // Limpar dados existentes (ordem importa por causa das foreign keys)
    console.log('Limpando dados existentes...')
    await prisma.shift.deleteMany()
    await prisma.physiotherapistTeam.deleteMany()
    await prisma.user.deleteMany()
    await prisma.physiotherapist.deleteMany()
    await prisma.shiftTeam.deleteMany()
    
    console.log('✅ Dados limpos')
    console.log('')
    
    // Importar dados na ordem correta
    console.log(`Importando ${data.users.length} usuários...`)
    for (const user of data.users) {
      await prisma.user.create({ data: user })
    }
    
    console.log(`Importando ${data.physiotherapists.length} fisioterapeutas...`)
    for (const physio of data.physiotherapists) {
      await prisma.physiotherapist.create({ data: physio })
    }
    
    console.log(`Importando ${data.shiftTeams.length} equipes...`)
    for (const team of data.shiftTeams) {
      await prisma.shiftTeam.create({ data: team })
    }
    
    console.log(`Importando ${data.shifts.length} plantões...`)
    for (const shift of data.shifts) {
      await prisma.shift.create({ data: shift })
    }
    
    console.log('')
    console.log('✅ Importação concluída com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro ao importar dados:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

importData()
EOF

# Copiar script para o container
docker cp /tmp/import-script.js "$APP_CONTAINER:/tmp/import-script.js"

# Executar importação
echo "Executando importação..."
echo ""
docker exec "$APP_CONTAINER" node /tmp/import-script.js

# Limpar arquivos temporários
docker exec "$APP_CONTAINER" rm /tmp/backup.json /tmp/import-script.js
rm /tmp/import-script.js

echo ""
echo "✅ Processo concluído!"
echo "Teste agora: https://fisio.furquim.cloud"
