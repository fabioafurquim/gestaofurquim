# 🗄️ Backup e Restore do Banco de Dados

## 📋 Passo a Passo Completo

### **1️⃣ Fazer Backup do Banco Local**

Execute no PowerShell:

```powershell
.\backup-database.ps1
```

**O que acontece:**
- Cria um arquivo `backup_plantaofisio_YYYYMMDD_HHMMSS.sql`
- Contém todos os dados do seu banco local
- Arquivo fica na pasta do projeto

---

### **2️⃣ Restaurar Backup em Produção**

Execute no PowerShell:

```powershell
.\restore-database.ps1
```

**O que acontece:**
1. Lista todos os backups disponíveis
2. Você escolhe qual backup usar
3. Pede confirmação (⚠️ vai substituir dados em produção!)
4. Transfere arquivo para o servidor
5. Restaura no banco de produção

---

## ⚠️ IMPORTANTE

### **Antes de Restaurar em Produção:**

1. ✅ Certifique-se que o backup está correto
2. ✅ Avise outros usuários (se houver)
3. ✅ Considere fazer backup da produção antes

### **O Restore VAI:**
- ❌ **APAGAR todos os dados atuais em produção**
- ✅ Substituir por dados do backup local

---

## 🔧 Comandos Manuais (Avançado)

### Fazer Backup Manual

```powershell
$env:PGPASSWORD = "Fmm20615"
pg_dump -h localhost -p 5432 -U postgres -d plantaofisio -F p -f backup.sql
Remove-Item Env:\PGPASSWORD
```

### Restaurar Manual em Produção

```bash
# No servidor
ssh root@187.77.57.122

# Copiar backup para container
docker cp backup.sql jk4ss8ssocc4owows0csw4kg:/tmp/backup.sql

# Limpar banco atual
docker exec jk4ss8ssocc4owows0csw4kg psql -U postgres -d plantaofisio -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restaurar backup
docker exec jk4ss8ssocc4owows0csw4kg psql -U postgres -d plantaofisio -f /tmp/backup.sql
```

---

## 🐛 Problemas Comuns

### `pg_dump: command not found`

**Solução:** Instale o PostgreSQL client no Windows
- Download: https://www.postgresql.org/download/windows/
- Ou use: `winget install PostgreSQL.PostgreSQL`

### Erro de conexão SSH

**Solução:** Verifique se tem acesso SSH ao servidor
```powershell
ssh root@187.77.57.122
```

### Backup muito grande

**Solução:** Compacte o arquivo antes de transferir
```powershell
Compress-Archive -Path backup.sql -DestinationPath backup.zip
```

---

## 📊 Verificar Dados Após Restore

1. Acesse: https://fisio.furquim.cloud
2. Faça login
3. Verifique se os dados estão corretos:
   - Fisioterapeutas
   - Equipes
   - Plantões
   - Usuários

---

## 💡 Dicas

### Backup Automático

Agende o script de backup para rodar diariamente:
- Windows: Task Scheduler
- Comando: `powershell.exe -File "C:\htdocs\plantaofisio\backup-database.ps1"`

### Manter Histórico de Backups

Os scripts mantém o timestamp no nome do arquivo, então você pode ter múltiplos backups:
```
backup_plantaofisio_20260226_100000.sql
backup_plantaofisio_20260226_150000.sql
backup_plantaofisio_20260227_100000.sql
```

### Backup Antes de Deploy

Sempre faça backup antes de fazer deploy de mudanças grandes:
```powershell
# 1. Backup
.\backup-database.ps1

# 2. Deploy
git push origin main
# Redeploy no Coolify

# 3. Se der problema, restore do backup
.\restore-database.ps1
```

---

## ✅ Checklist

**Antes do Restore:**
- [ ] Backup do banco local criado
- [ ] Backup testado (opcional mas recomendado)
- [ ] Outros usuários avisados
- [ ] Confirmação de que quer substituir dados em produção

**Depois do Restore:**
- [ ] Login funcionando
- [ ] Dados visíveis na aplicação
- [ ] Funcionalidades testadas

---

## 🔐 Segurança

**Não commite backups no Git!**

Os arquivos `.sql` já estão no `.gitignore`, mas verifique:
```bash
git status
# Não deve aparecer arquivos .sql
```

**Armazene backups em local seguro:**
- Google Drive
- OneDrive
- Backup externo
