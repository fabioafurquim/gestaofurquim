# 🛡️ Protocolo de Segurança e Backup

## ⚠️ REGRAS CRÍTICAS DE SEGURANÇA

### 🚨 NUNCA FAÇA ISSO SEM BACKUP:
- `npx prisma migrate reset`
- `npx prisma db push --force-reset`
- Qualquer comando que modifique o schema do banco
- Operações que possam causar perda de dados

### ✅ SEMPRE FAÇA ISSO ANTES:
1. **Verificar se há dados importantes no banco**
2. **Criar backup automático**
3. **Solicitar confirmação explícita do usuário**
4. **Documentar a operação**

## 🔧 Scripts de Segurança Implementados

### 1. Backup Automático
```bash
# Criar backup manual
npm run db:backup

# Ou diretamente
node scripts/auto-backup.js
```

### 2. Comandos Seguros do Prisma
```bash
# Usar sempre estes comandos em vez dos originais:
npm run db:reset          # Em vez de: npx prisma migrate reset
npm run db:migrate-dev    # Em vez de: npx prisma migrate dev
npm run db:push           # Em vez de: npx prisma db push
```

### 3. Verificação de Dados
```javascript
const { hasImportantData } = require('./scripts/auto-backup');

// Verificar antes de operações destrutivas
if (await hasImportantData()) {
  // Fazer backup obrigatório
}
```

## 📁 Estrutura de Backups

```
backups/
├── auto-backup-migrate-dev-2025-01-20T10-30-00.json
├── auto-backup-schema-change-2025-01-20T11-15-30.json
└── manual-backup-2025-01-20T12-00-00.json
```

## 🔄 Fluxo de Segurança

### Para Migrações de Schema:
1. **Detecção automática** de comandos que modificam schema
2. **Verificação** se há dados importantes
3. **Backup automático** se necessário
4. **Execução** do comando original
5. **Log** da operação

### Para Comandos Destrutivos:
1. **Alerta** de operação perigosa
2. **Solicitação** de confirmação explícita
3. **Backup obrigatório** se há dados
4. **Confirmação** do usuário (digitar "CONFIRMO")
5. **Execução** apenas após confirmação

## 📋 Checklist de Segurança

### Antes de Qualquer Migração:
- [ ] Verificar se há dados importantes
- [ ] Criar backup se necessário
- [ ] Testar em ambiente de desenvolvimento
- [ ] Documentar mudanças

### Antes de Reset do Banco:
- [ ] **OBRIGATÓRIO**: Backup completo
- [ ] Confirmação explícita do usuário
- [ ] Verificar se há alternativas menos destrutivas
- [ ] Documentar motivo do reset

## 🚨 Recuperação de Dados

### Se Houver Perda Acidental:
1. **Parar** todas as operações imediatamente
2. **Verificar** backups disponíveis em `./backups/`
3. **Restaurar** do backup mais recente
4. **Validar** integridade dos dados
5. **Documentar** o incidente

### Restauração de Backup:
```bash
# Implementar script de restauração (TODO)
node scripts/restore-backup.js backup-file.json
```

## 📊 Monitoramento

### Logs de Segurança:
- Todas as operações de backup são logadas
- Comandos destrutivos são registrados
- Confirmações do usuário são documentadas

### Alertas Automáticos:
- ⚠️ Operação destrutiva detectada
- 🔒 Backup automático criado
- ✅ Operação concluída com segurança

## 🎯 Próximas Melhorias

- [ ] Script de restauração automática
- [ ] Backup incremental
- [ ] Integração com cloud storage
- [ ] Alertas por email/Slack
- [ ] Versionamento de backups
- [ ] Limpeza automática de backups antigos

---

**🔒 LEMBRE-SE: A segurança dos dados é SEMPRE prioridade máxima!**

**📞 Em caso de dúvidas, SEMPRE pergunte antes de executar comandos destrutivos.**