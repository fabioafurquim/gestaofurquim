# 🚀 Configuração Telegram em Produção

## 📋 Visão Geral

Em produção, o sistema Telegram funciona de forma diferente do desenvolvimento:

- **Desenvolvimento:** Script de polling (`node scripts/telegram-polling.js`)
- **Produção:** Webhook automático + Cron jobs no Coolify

---

## 🔧 Configuração no Coolify

### 1️⃣ Variáveis de Ambiente

No painel do Coolify, configure as seguintes variáveis de ambiente:

```bash
# Token do Bot Telegram
TELEGRAM_BOT_TOKEN=seu_token_aqui

# URL da aplicação (para webhook)
NEXTAUTH_URL=https://fisio.furquim.cloud

# Secret para cron jobs
CRON_SECRET=gere_um_secret_forte_aqui
```

**Como gerar CRON_SECRET:**
```bash
# No terminal, execute:
openssl rand -base64 32
```

---

## 🔗 Configuração do Webhook

### Opção 1: Via Painel de Administração (Recomendado)

1. Acesse: https://fisio.furquim.cloud/admin/telegram
2. Clique em **"🔗 Configurar Webhook"**
3. Pronto! O webhook será configurado automaticamente

### Opção 2: Via API Manual

```bash
curl -X POST https://fisio.furquim.cloud/api/admin/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{"action": "set"}'
```

### Verificar Status do Webhook

```bash
curl https://api.telegram.org/bot<SEU_TOKEN>/getWebhookInfo
```

**Resposta esperada:**
```json
{
  "ok": true,
  "result": {
    "url": "https://fisio.furquim.cloud/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## ⏰ Configuração de Cron Jobs no Coolify

### 1. Acessar Configuração de Cron

1. Abra o painel do Coolify
2. Vá em **Applications** → **plantaofisio**
3. Clique em **Scheduled Tasks** ou **Cron Jobs**

### 2. Criar Cron Job para Notificações Diárias

**Nome:** Notificações Diárias de Plantões

**Schedule (Cron Expression):**
```
0 18 * * *
```
*Executa todos os dias às 18:00 (6 PM)*

**Comando:**
```bash
curl -X GET "https://fisio.furquim.cloud/api/cron/notify-shifts" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

**Ou usando wget:**
```bash
wget --quiet --output-document=/dev/null \
  --header="Authorization: Bearer ${CRON_SECRET}" \
  "https://fisio.furquim.cloud/api/cron/notify-shifts"
```

### 3. Outras Opções de Horário

```bash
# Às 8h da manhã
0 8 * * *

# Às 20h (8 PM)
0 20 * * *

# Às 18h de segunda a sexta
0 18 * * 1-5

# A cada 6 horas
0 */6 * * *
```

---

## 🎛️ Painel de Controle

### Acessar Painel de Administração Telegram

**URL:** https://fisio.furquim.cloud/admin/telegram

**Funcionalidades:**
- ✅ Ver status do bot
- ✅ Ver status do webhook
- ✅ Configurar/Reconfigurar webhook
- ✅ Remover webhook
- ✅ Testar bot (enviar mensagem de teste)
- ✅ Atualizar status em tempo real

**Acesso:** Apenas usuários com role **ADMIN**

---

## 🔍 Monitoramento e Troubleshooting

### Verificar Logs do Bot

**No Coolify:**
1. Vá em **Applications** → **plantaofisio**
2. Clique em **Logs**
3. Procure por mensagens relacionadas a Telegram

**Comandos úteis:**
```bash
# Ver logs em tempo real
docker logs -f <container_id>

# Buscar erros do Telegram
docker logs <container_id> | grep -i telegram

# Buscar notificações enviadas
docker logs <container_id> | grep -i "notificação enviada"
```

### Problemas Comuns

#### ❌ Webhook não funciona

**Causa:** Certificado SSL inválido ou URL incorreta

**Solução:**
1. Verifique se o domínio tem SSL válido (https)
2. Teste a URL: `curl https://fisio.furquim.cloud/api/telegram/webhook`
3. Reconfigure o webhook pelo painel

#### ❌ Notificações não são enviadas

**Causa:** Fisioterapeuta sem Chat ID vinculado

**Solução:**
1. Acesse: https://fisio.furquim.cloud/physiotherapists
2. Edite o fisioterapeuta
3. Preencha o Chat ID na seção Telegram
4. Salve

#### ❌ Cron job não executa

**Causa:** CRON_SECRET incorreto ou cron não configurado

**Solução:**
1. Verifique se `CRON_SECRET` está configurado no Coolify
2. Verifique se o cron job está ativo
3. Teste manualmente:
```bash
curl -X GET "https://fisio.furquim.cloud/api/cron/notify-shifts" \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

---

## 🧪 Testes em Produção

### 1. Testar Webhook

```bash
# Envie /start para o bot no Telegram
# Você deve receber a mensagem de boas-vindas
```

### 2. Testar Notificação Instantânea

1. Vincule um fisioterapeuta ao Telegram
2. Crie um plantão para esse fisioterapeuta
3. Você deve receber notificação imediatamente

### 3. Testar Notificação Diária

**Opção 1: Via Painel**
1. Acesse: https://fisio.furquim.cloud/settings
2. Role até "Notificações Telegram"
3. Clique em "Testar Notificações Automáticas Agora"

**Opção 2: Via API**
```bash
curl -X GET "https://fisio.furquim.cloud/api/cron/notify-shifts" \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

### 4. Testar Bot (Enviar Mensagem de Teste)

1. Acesse: https://fisio.furquim.cloud/admin/telegram
2. Clique em "🧪 Testar Bot"
3. Todos os fisioterapeutas vinculados receberão uma mensagem de teste

---

## 📊 Monitoramento de Notificações

### Ver Logs de Notificações

**No sistema:**
1. Acesse: https://fisio.furquim.cloud/settings
2. Role até "Notificações Telegram"
3. Veja a seção "Últimas Notificações Enviadas"

**No banco de dados:**
```sql
SELECT * FROM "NotificationLog" 
ORDER BY "sentAt" DESC 
LIMIT 10;
```

### Estatísticas

```sql
-- Total de notificações enviadas hoje
SELECT COUNT(*) FROM "NotificationLog" 
WHERE DATE("sentAt") = CURRENT_DATE;

-- Taxa de sucesso
SELECT 
  status,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM "NotificationLog"
GROUP BY status;

-- Fisioterapeutas sem Telegram vinculado
SELECT id, name, email 
FROM "Physiotherapist" 
WHERE "telegramChatId" IS NULL 
AND status = 'ACTIVE';
```

---

## 🔄 Migração de Desenvolvimento para Produção

### Checklist de Deploy

- [ ] Variáveis de ambiente configuradas no Coolify
- [ ] TELEGRAM_BOT_TOKEN configurado
- [ ] CRON_SECRET configurado
- [ ] NEXTAUTH_URL configurado
- [ ] Webhook configurado via painel admin
- [ ] Cron job criado no Coolify
- [ ] Teste de notificação instantânea realizado
- [ ] Teste de notificação diária realizado
- [ ] Fisioterapeutas com Chat ID vinculado

### Comandos de Deploy

```bash
# 1. Fazer commit das alterações
git add .
git commit -m "feat: adicionar sistema de notificações Telegram"

# 2. Push para GitHub
git push origin main

# 3. Coolify fará deploy automático

# 4. Após deploy, configurar webhook
# Acesse: https://fisio.furquim.cloud/admin/telegram
# Clique em "Configurar Webhook"

# 5. Configurar cron job no painel do Coolify
```

---

## 🛡️ Segurança

### Boas Práticas

1. **Nunca commitar tokens:**
   - Adicione `.env` ao `.gitignore`
   - Use variáveis de ambiente no Coolify

2. **CRON_SECRET forte:**
   - Use `openssl rand -base64 32`
   - Nunca exponha publicamente

3. **Validação de webhook:**
   - O Telegram valida o webhook automaticamente
   - Use HTTPS (SSL válido)

4. **Logs sensíveis:**
   - Não logue tokens ou Chat IDs completos
   - Use mascaramento: `123***789`

---

## 📞 Suporte

### Comandos do Bot

- `/start` - Iniciar e ver Chat ID
- `/status` - Verificar vinculação
- `/help` - Ver comandos disponíveis

### Contato

Em caso de problemas, verifique:
1. Logs do Coolify
2. Painel de administração Telegram
3. Status do webhook
4. Logs de notificação no sistema

---

## 📝 Resumo Rápido

**Para colocar em produção:**

1. Configure variáveis de ambiente no Coolify
2. Acesse https://fisio.furquim.cloud/admin/telegram
3. Clique em "Configurar Webhook"
4. Configure cron job no Coolify (diário às 18h)
5. Teste enviando `/start` no bot
6. Vincule fisioterapeutas ao Telegram
7. Teste criando um plantão

**Pronto! Sistema funcionando em produção! 🎉**
