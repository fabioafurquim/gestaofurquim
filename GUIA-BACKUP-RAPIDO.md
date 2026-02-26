# 🗄️ Guia Rápido - Backup e Restore

## ⚡ Método Mais Simples (Recomendado)

### 1️⃣ Fazer Backup do Banco Local

```bash
node scripts/export-data.js
```

**Resultado:** Cria arquivo `backup_2026-02-26.json` com todos os dados.

---

### 2️⃣ Transferir para Produção

```powershell
scp backup_2026-02-26.json root@187.77.57.122:/root/
```

---

### 3️⃣ Importar em Produção

```bash
# Transferir script de importação
scp import-to-production.js root@187.77.57.122:/tmp/

# Executar importação
ssh root@187.77.57.122 "APP_CONTAINER=\$(docker ps -q --filter 'name=g48wk8goo88g8k8cw4cs484g') && docker cp /tmp/import-to-production.js \$APP_CONTAINER:/app/ && docker cp /root/backup_2026-02-26.json \$APP_CONTAINER:/app/backup.json && docker exec \$APP_CONTAINER node /app/import-to-production.js"
```

**⚠️ Isso vai substituir TODOS os dados em produção!**

---

## 📋 Resumo Completo

| Passo | Comando | Onde Executar |
|-------|---------|---------------|
| 1. Backup | `node scripts/export-data.js` | Local (Windows) |
| 2. Transferir | `scp backup_*.json root@187.77.57.122:/root/` | Local (Windows) |
| 3. Importar | `bash import-data-production.sh backup_*.json` | Servidor (SSH) |
| 4. Testar | Acesse https://fisio.furquim.cloud | Navegador |

---

## 🔧 Comandos Prontos para Copiar

### Backup Local
```bash
node scripts/export-data.js
```

### Transferir e Importar (Tudo de Uma Vez)
```powershell
# 1. Fazer backup
node scripts/export-data.js

# 2. Transferir
$backup = (Get-ChildItem backup_*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).Name
scp $backup root@187.77.57.122:/root/

# 3. Importar
ssh root@187.77.57.122 "bash /root/import-data-production.sh /root/$backup"
```

---

## ✅ O Que Vai Ser Copiado

- ✅ Usuários (logins e senhas)
- ✅ Fisioterapeutas (cadastros completos)
- ✅ Equipes (configurações de plantões)
- ✅ Plantões (escalas)

---

## ⚠️ Importante

1. **Backup é automático:** Não precisa instalar PostgreSQL
2. **Formato JSON:** Fácil de visualizar e editar se necessário
3. **Dados sensíveis:** Arquivos `backup_*.json` NÃO vão para o Git
4. **Substituição total:** O import APAGA dados atuais em produção

---

## 🐛 Problemas?

### Erro ao exportar
```bash
# Verifique se o banco local está rodando
# Tente conectar manualmente
```

### Erro ao importar
```bash
# Verifique se o arquivo foi transferido
ssh root@187.77.57.122 "ls -lh /root/backup_*.json"
```

### Dados não aparecem
```bash
# Limpe cache do navegador
# Faça logout e login novamente
```

---

## 💡 Dica Pro

Crie um alias no PowerShell para facilitar:

```powershell
# Adicione no seu $PROFILE
function Backup-Database {
    node scripts/export-data.js
    $backup = (Get-ChildItem backup_*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).Name
    Write-Host "Backup criado: $backup" -ForegroundColor Green
}

function Restore-Database {
    $backup = (Get-ChildItem backup_*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).Name
    Write-Host "Transferindo $backup..." -ForegroundColor Yellow
    scp $backup root@187.77.57.122:/root/
    Write-Host "Importando em produção..." -ForegroundColor Yellow
    ssh root@187.77.57.122 "bash /root/import-data-production.sh /root/$backup"
}
```

Depois use apenas:
```powershell
Backup-Database
Restore-Database
```
