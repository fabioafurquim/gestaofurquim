# ✅ Checklist de Deploy - Sistema Telegram

## 📋 Pré-Deploy (Desenvolvimento)

- [x] Bot Telegram criado via @BotFather
- [x] Token do bot obtido
- [x] Campos `telegramChatId` e `telegramUsername` no schema Prisma
- [x] API de notificações implementada
- [x] Webhook endpoint criado (`/api/telegram/webhook`)
- [x] Painel de administração criado (`/admin/telegram`)
- [x] Testado em desenvolvimento com polling

## 🚀 Deploy para Produção

### 1. Configurar Variáveis de Ambiente no Coolify

```bash
TELEGRAM_BOT_TOKEN=7924086451:AAH...  # Token do @BotFather
CRON_SECRET=<gerar com: openssl rand -base64 32>
NEXTAUTH_URL=https://fisio.furquim.cloud
```

**Como configurar:**
1. Acesse painel do Coolify
2. Vá em **Applications** → **plantaofisio**
3. Clique em **Environment Variables**
4. Adicione as 3 variáveis acima
5. Clique em **Save**
6. Reinicie a aplicação

### 2. Fazer Deploy do Código

```bash
# No seu computador local:
git add .
git commit -m "feat: adicionar sistema completo de notificações Telegram"
git push origin main

# Coolify detecta e faz deploy automático
```

### 3. Configurar Webhook (Após Deploy)

**Opção A: Via Painel Web (Recomendado)**
1. Acesse: https://fisio.furquim.cloud/admin/telegram
2. Login como ADMIN
3. Clique em **"🔗 Configurar Webhook"**
4. Aguarde confirmação de sucesso

**Opção B: Via SSH no VPS**
```bash
# Conectar no VPS
ssh root@seu-vps-ip

# Configurar webhook
curl -X POST https://fisio.furquim.cloud/api/admin/telegram/webhook \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=SEU_TOKEN_AQUI" \
  -d '{"action": "set"}'
```

### 4. Configurar Cron Job no Coolify

**No painel do Coolify:**
1. Vá em **Applications** → **plantaofisio**
2. Clique em **Scheduled Tasks** (ou **Cron Jobs**)
3. Clique em **Add New**
4. Preencha:
   - **Name:** Notificações Diárias Telegram
   - **Schedule:** `0 18 * * *` (diariamente às 18h)
   - **Command:**
     ```bash
     curl -X GET "https://fisio.furquim.cloud/api/cron/notify-shifts" \
       -H "Authorization: Bearer ${CRON_SECRET}"
     ```
5. Clique em **Save**

**Alternativa com wget:**
```bash
wget --quiet --output-document=/dev/null \
  --header="Authorization: Bearer ${CRON_SECRET}" \
  "https://fisio.furquim.cloud/api/cron/notify-shifts"
```

## 🧪 Testes Pós-Deploy

### Teste 1: Bot Respondendo
```bash
# No Telegram, envie para o bot:
/start

# Deve receber:
# - Mensagem de boas-vindas
# - Seu Chat ID
# - Instruções para vincular
```

### Teste 2: Comando /status
```bash
# No Telegram:
/status

# Se não vinculado: mostra instruções
# Se vinculado: mostra confirmação com seu nome
```

### Teste 3: Webhook Ativo
```bash
# Via terminal ou navegador:
curl https://api.telegram.org/bot<SEU_TOKEN>/getWebhookInfo

# Deve retornar:
# "url": "https://fisio.furquim.cloud/api/telegram/webhook"
# "pending_update_count": 0
```

### Teste 4: Painel de Administração
1. Acesse: https://fisio.furquim.cloud/admin/telegram
2. Verifique:
   - ✅ Bot Info aparece
   - ✅ Webhook URL está configurada
   - ✅ Pending updates = 0

### Teste 5: Vincular Fisioterapeuta
1. Acesse: https://fisio.furquim.cloud/physiotherapists
2. Edite um fisioterapeuta
3. Cole o Chat ID na seção Telegram
4. Salve
5. Volte em editar - Chat ID deve estar salvo

### Teste 6: Notificação Instantânea
1. Crie um plantão para fisioterapeuta vinculado
2. Deve receber mensagem no Telegram imediatamente
3. Verifique logs em: https://fisio.furquim.cloud/settings

### Teste 7: Notificação Diária Manual
1. Acesse: https://fisio.furquim.cloud/settings
2. Role até "Notificações Telegram"
3. Clique em "Testar Notificações Automáticas Agora"
4. Fisioterapeutas com plantões amanhã devem receber

### Teste 8: Cron Job
```bash
# Executar manualmente:
curl -X GET "https://fisio.furquim.cloud/api/cron/notify-shifts" \
  -H "Authorization: Bearer SEU_CRON_SECRET"

# Deve retornar JSON com:
# - total: número de plantões
# - sent: número de notificações enviadas
```

## 🔍 Verificações de Segurança

- [ ] `.env` está no `.gitignore`
- [ ] Tokens não estão commitados no Git
- [ ] CRON_SECRET é forte (32+ caracteres)
- [ ] Webhook usa HTTPS (SSL válido)
- [ ] Apenas ADMINs acessam `/admin/telegram`

## 📊 Monitoramento Contínuo

### Diariamente
- Verificar logs de notificações em `/settings`
- Verificar se cron job executou (às 18h)

### Semanalmente
- Acessar `/admin/telegram` e verificar status
- Verificar fisioterapeutas sem Telegram vinculado

### Mensalmente
- Revisar logs de erros no Coolify
- Testar bot com mensagem de teste

## 🆘 Troubleshooting Rápido

### Bot não responde
```bash
# 1. Verificar webhook
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# 2. Se webhook vazio, reconfigurar
# Acesse: https://fisio.furquim.cloud/admin/telegram
# Clique em "Configurar Webhook"
```

### Notificações não chegam
```bash
# 1. Verificar se fisioterapeuta tem Chat ID
# 2. Testar bot manualmente: /admin/telegram → "Testar Bot"
# 3. Verificar logs em /settings
```

### Cron não executa
```bash
# 1. Verificar se cron está ativo no Coolify
# 2. Testar manualmente com curl
# 3. Verificar CRON_SECRET está correto
```

## 📞 Comandos Úteis

### Ver logs em tempo real (SSH no VPS)
```bash
# Logs do container
docker logs -f <container_id>

# Buscar erros Telegram
docker logs <container_id> | grep -i telegram

# Últimas 100 linhas
docker logs --tail 100 <container_id>
```

### Resetar webhook
```bash
# Deletar webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/deleteWebhook

# Reconfigurar
# Acesse: https://fisio.furquim.cloud/admin/telegram
```

### Verificar banco de dados
```bash
# Fisioterapeutas com Telegram
SELECT id, name, "telegramChatId" 
FROM "Physiotherapist" 
WHERE "telegramChatId" IS NOT NULL;

# Últimas notificações
SELECT * FROM "NotificationLog" 
ORDER BY "sentAt" DESC LIMIT 10;
```

## ✅ Checklist Final

- [ ] Variáveis configuradas no Coolify
- [ ] Deploy realizado com sucesso
- [ ] Webhook configurado e ativo
- [ ] Cron job criado (diário às 18h)
- [ ] Bot responde a `/start`
- [ ] Comando `/status` funciona
- [ ] Fisioterapeutas vinculados ao Telegram
- [ ] Notificação instantânea testada
- [ ] Notificação diária testada
- [ ] Painel `/admin/telegram` acessível
- [ ] Logs de notificação visíveis em `/settings`

## 🎉 Pronto para Produção!

Após completar todos os itens acima, o sistema está 100% funcional em produção!

**URLs importantes:**
- Painel Admin: https://fisio.furquim.cloud/admin/telegram
- Configurações: https://fisio.furquim.cloud/settings
- Fisioterapeutas: https://fisio.furquim.cloud/physiotherapists

**Contatos do Bot:**
- Envie `/start` para começar
- Envie `/status` para verificar vinculação
- Envie `/help` para ver comandos
