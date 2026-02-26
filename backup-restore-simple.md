# 🗄️ Backup e Restore Simplificado (Sem pg_dump)

## Método Mais Simples - Usando Prisma

Se você não tem `pg_dump` instalado, use este método:

---

## 📤 Fazer Backup (Exportar Dados)

### 1. Criar script de exportação

Crie o arquivo `scripts/export-data.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function exportData() {
  console.log('Exportando dados...')
  
  const data = {
    users: await prisma.user.findMany(),
    physiotherapists: await prisma.physiotherapist.findMany(),
    teams: await prisma.team.findMany(),
    shifts: await prisma.shift.findMany(),
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `backup_${timestamp}.json`
  
  fs.writeFileSync(filename, JSON.stringify(data, null, 2))
  
  console.log(`✅ Backup criado: ${filename}`)
  console.log(`Tamanho: ${(fs.statSync(filename).size / 1024).toFixed(2)} KB`)
  
  await prisma.$disconnect()
}

exportData()
```

### 2. Executar exportação

```bash
npx ts-node scripts/export-data.ts
```

---

## 📥 Restaurar Backup (Importar Dados)

### 1. Transferir arquivo JSON para o servidor

```powershell
scp backup_2026-02-26T13-49-31-000Z.json root@187.77.57.122:/tmp/backup.json
```

### 2. Criar script de importação no servidor

```bash
ssh root@187.77.57.122

# Criar script de importação
cat > /tmp/import-data.js << 'EOF'
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:eLE1NPit1YQKnVU1o2QTABzxPZ46v9iAHyTlXWNwUxv6CCco1sFi5nOeCVSEHhKp@jk4ss8ssocc4owows0csw4kg:5432/plantaofisio'
    }
  }
})

async function importData() {
  console.log('Importando dados...')
  
  const data = JSON.parse(fs.readFileSync('/tmp/backup.json', 'utf8'))
  
  // Limpar dados existentes
  console.log('Limpando dados existentes...')
  await prisma.shift.deleteMany()
  await prisma.physiotherapist.deleteMany()
  await prisma.team.deleteMany()
  await prisma.user.deleteMany()
  
  // Importar dados
  console.log('Importando usuários...')
  for (const user of data.users) {
    await prisma.user.create({ data: user })
  }
  
  console.log('Importando fisioterapeutas...')
  for (const physio of data.physiotherapists) {
    await prisma.physiotherapist.create({ data: physio })
  }
  
  console.log('Importando equipes...')
  for (const team of data.teams) {
    await prisma.team.create({ data: team })
  }
  
  console.log('Importando plantões...')
  for (const shift of data.shifts) {
    await prisma.shift.create({ data: shift })
  }
  
  console.log('✅ Importação concluída!')
  
  await prisma.$disconnect()
}

importData()
EOF

# Executar importação dentro do container
docker exec -i $(docker ps -q --filter "name=g48wk8goo88g8k8cw4cs484g") node /tmp/import-data.js
```

---

## 🚀 Método Ainda Mais Simples - Copiar Schema

Se você só quer sincronizar o schema (estrutura) sem dados:

```bash
# Local - gerar migration
npx prisma migrate dev --name sync_production

# Produção - aplicar migration
ssh root@187.77.57.122
docker exec -it $(docker ps -q --filter "name=g48wk8goo88g8k8cw4cs484g") npx prisma migrate deploy
```

---

## ⚡ Método Rápido - Dump Direto via Docker

Se você tem Docker Desktop rodando PostgreSQL local:

```powershell
# Fazer dump do banco local
docker exec -i postgres_local pg_dump -U postgres plantaofisio > backup.sql

# Transferir para servidor
scp backup.sql root@187.77.57.122:/tmp/backup.sql

# Restaurar em produção
ssh root@187.77.57.122 "docker exec -i jk4ss8ssocc4owows0csw4kg psql -U postgres -d plantaofisio < /tmp/backup.sql"
```

---

## 📋 Qual Método Usar?

| Método | Quando Usar | Vantagens |
|--------|-------------|-----------|
| **pg_dump** (scripts .ps1) | Você tem PostgreSQL instalado | Mais rápido, backup completo |
| **Prisma/JSON** | Não tem pg_dump | Funciona sempre, portável |
| **Migrate** | Só quer estrutura | Muito simples, sem dados |
| **Docker** | Usa Docker local | Rápido, não precisa instalar nada |

---

## 💡 Recomendação

**Para você agora:** Use o método Prisma/JSON (mais simples)

**Para futuro:** Instale PostgreSQL client para usar pg_dump (mais profissional)
