# 🤖 Sistema de Notificações Telegram - Guia Completo

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Configuração Inicial](#configuração-inicial)
3. [Configuração do Bot](#configuração-do-bot)
4. [Configuração do Servidor](#configuração-do-servidor)
5. [Vinculação de Fisioterapeutas](#vinculação-de-fisioterapeutas)
6. [Configuração do Cron Job](#configuração-do-cron-job)
7. [Painel Administrativo](#painel-administrativo)
8. [Testes](#testes)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O sistema de notificações Telegram envia automaticamente:

1. **Lembrete Diário**: Notificação 1 dia antes do plantão (horário configurável)
2. **Notificação Instantânea**: Notificação imediata ao cadastrar um novo plantão

### Funcionalidades

✅ Notificações via Telegram Bot API (100% gratuito)  
✅ Templates de mensagem personalizáveis  
✅ Painel administrativo para configuração  
✅ Habilitar/desabilitar notificações a qualquer momento  
✅ Logs de envio para auditoria  
✅ Vinculação simples de fisioterapeutas  

---

## ⚙️ Configuração Inicial

### Pré-requisitos

- ✅ Sistema já instalado e funcionando
- ✅ PostgreSQL configurado
- ✅ Conta no Telegram

### 1. Criar Bot no Telegram

**Passo 1:** Abra o Telegram e busque por `@BotFather`

**Passo 2:** Envie o comando `/newbot`

**Passo 3:** Siga as instruções:
```
BotFather: Alright, a new bot. How are we going to call it? Please choose a name for your bot.
Você: Plantões Furquim

BotFather: Good. Now let's choose a username for your bot. It must end in `bot`. Like this, for example: TetrisBot or tetris_bot.
Você: plantoes_furquim_bot

BotFather: Done! Congratulations on your new bot. You will find it at t.me/plantoes_furquim_bot
```

**Passo 4:** O BotFather enviará o **token de API**. Copie e guarde com segurança:
```
Use this token to access the HTTP API:
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567890
```

### 2. Configurar Comandos do Bot

Envie para o BotFather:
```
/setcommands
```

Selecione seu bot e cole:
```
start - Instruções de vinculação
status - Verificar status da vinculação
help - Exibir ajuda
```

### 3. Configurar Descrição do Bot

```
/setdescription
```

Selecione seu bot e cole:
```
Bot oficial do Sistema de Gestão de Plantões Furquim. Receba notificações automáticas sobre seus plantões.
```

---

## 🔧 Configuração do Servidor

### 1. Variáveis de Ambiente

Adicione ao arquivo `.env` (desenvolvimento) ou configure no Coolify (produção):

```env
# Token do bot criado no BotFather
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567890"

# Secret para proteger o endpoint de cron job
CRON_SECRET="gere-um-secret-aleatorio-aqui"
```

**Gerar CRON_SECRET:**
```bash
# Linux/Mac
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 2. Aplicar Migration

**Desenvolvimento:**
```bash
npx prisma migrate deploy
```

**Produção (via SSH):**
```bash
ssh root@187.77.57.122
docker exec <CONTAINER_ID> npx prisma migrate deploy
```

### 3. Configurar Webhook (Opcional)

Se quiser receber mensagens em tempo real:

```bash
curl -X POST "https://api.telegram.org/bot<SEU_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://fisio.furquim.cloud/api/telegram/webhook"}'
```

**Verificar webhook:**
```bash
curl "https://api.telegram.org/bot<SEU_TOKEN>/getWebhookInfo"
```

---

## 👥 Vinculação de Fisioterapeutas

### Método 1: Via Interface (Recomendado)

1. Acesse o sistema como **ADMIN**
2. Vá em **Fisioterapeutas**
3. Clique em um fisioterapeuta
4. Na seção "Telegram", clique em **"Vincular Telegram"**
5. Peça ao fisioterapeuta para:
   - Abrir o Telegram
   - Buscar pelo bot: `@plantoes_furquim_bot`
   - Clicar em **START**
   - Enviar `/status` para verificar
6. O sistema mostrará o **Chat ID** do fisioterapeuta
7. Cole o Chat ID no campo e clique em **"Salvar"**

### Método 2: Via API

```bash
curl -X POST "https://fisio.furquim.cloud/api/telegram/link" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SEU_TOKEN>" \
  -d '{
    "physiotherapistId": 1,
    "chatId": "123456789",
    "username": "nome_usuario"
  }'
```

### Comandos do Bot para Fisioterapeutas

**`/start`** - Exibe instruções de vinculação e mostra o Chat ID  
**`/status`** - Verifica se a conta está vinculada  
**`/help`** - Exibe lista de comandos disponíveis  

---

## ⏰ Configuração do Cron Job

### Opção 1: Serviço Externo (Recomendado para Produção)

Use **cron-job.org** (gratuito):

1. Acesse: https://cron-job.org
2. Crie uma conta
3. Clique em **"Create cronjob"**
4. Configure:
   - **Title:** Notificações Diárias Plantões
   - **URL:** `https://fisio.furquim.cloud/api/cron/notify-shifts`
   - **Schedule:** Diariamente às 18:00 (ou horário configurado)
   - **Request method:** GET
   - **Headers:** Adicione:
     ```
     Authorization: Bearer SEU_CRON_SECRET_AQUI
     ```
5. Salve e ative

### Opção 2: Crontab do Servidor (Linux)

```bash
# Editar crontab
crontab -e

# Adicionar linha (executa às 18:00 todos os dias)
0 18 * * * curl -H "Authorization: Bearer SEU_CRON_SECRET" https://fisio.furquim.cloud/api/cron/notify-shifts
```

### Opção 3: Systemd Timer (Linux Avançado)

Criar arquivo `/etc/systemd/system/notify-shifts.service`:
```ini
[Unit]
Description=Notificações de Plantões

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -H "Authorization: Bearer SEU_CRON_SECRET" https://fisio.furquim.cloud/api/cron/notify-shifts
```

Criar arquivo `/etc/systemd/system/notify-shifts.timer`:
```ini
[Unit]
Description=Timer para Notificações de Plantões

[Timer]
OnCalendar=daily
OnCalendar=18:00
Persistent=true

[Install]
WantedBy=timers.target
```

Ativar:
```bash
sudo systemctl enable notify-shifts.timer
sudo systemctl start notify-shifts.timer
```

---

## 🎛️ Painel Administrativo

### Acessar Painel

1. Login como **ADMIN**
2. Acesse: `https://fisio.furquim.cloud/notifications`

### Configurações Disponíveis

#### ⚙️ Configurações Gerais
- **Sistema de Notificações:** Liga/desliga todas as notificações

#### 📅 Lembrete Diário
- **Habilitar:** Liga/desliga lembretes diários
- **Horário:** Define quando enviar (ex: 18:00)
- **Mensagem:** Template personalizável

#### ⚡ Notificação Instantânea
- **Habilitar:** Liga/desliga notificações ao criar plantão
- **Mensagem:** Template personalizável

### Variáveis de Template

Use estas variáveis nas mensagens:

- `{{name}}` - Nome do fisioterapeuta
- `{{date}}` - Data do plantão formatada
- `{{period}}` - Período (Manhã, Tarde, Noite, Intermediário)
- `{{team}}` - Nome da equipe

**Exemplo de Template:**
```
🏥 Lembrete de Plantão

Olá, {{name}}! 👋

Você está escalado para amanhã:

📅 Data: {{date}}
⏰ Período: {{period}}
🏢 Equipe: {{team}}

Boa sorte! 💪
```

---

## 🧪 Testes

### 1. Testar Vinculação

```bash
# Fisioterapeuta abre bot e envia /start
# Sistema deve mostrar Chat ID

# Admin vincula via painel ou API
curl -X POST "http://localhost:3000/api/telegram/link" \
  -H "Content-Type: application/json" \
  -d '{
    "physiotherapistId": 1,
    "chatId": "SEU_CHAT_ID"
  }'

# Fisioterapeuta envia /status
# Deve mostrar: "✅ Sua conta está vinculada!"
```

### 2. Testar Notificação Instantânea

1. Habilite notificações instantâneas no painel
2. Cadastre um novo plantão
3. Fisioterapeuta deve receber notificação imediatamente

### 3. Testar Lembrete Diário

**Teste Manual:**
```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" \
  http://localhost:3000/api/cron/notify-shifts
```

**Resposta esperada:**
```json
{
  "message": "Notificações processadas",
  "total": 5,
  "sent": 5,
  "failed": 0,
  "timestamp": "2026-03-11T18:00:00.000Z"
}
```

### 4. Verificar Logs

```sql
-- Ver últimas notificações enviadas
SELECT 
  nl.id,
  p.name,
  nl.messageType,
  nl.status,
  nl.sentAt,
  nl.errorMessage
FROM "NotificationLog" nl
JOIN "Physiotherapist" p ON p.id = nl.physiotherapistId
ORDER BY nl.sentAt DESC
LIMIT 20;
```

---

## 🔍 Troubleshooting

### Problema: Bot não responde

**Causa:** Token inválido ou bot não iniciado

**Solução:**
1. Verifique se `TELEGRAM_BOT_TOKEN` está correto
2. Teste o token:
   ```bash
   curl "https://api.telegram.org/bot<SEU_TOKEN>/getMe"
   ```
3. Deve retornar informações do bot

### Problema: Notificações não são enviadas

**Causa:** Fisioterapeuta não vinculado ou notificações desabilitadas

**Solução:**
1. Verifique se fisioterapeuta tem `telegramChatId`:
   ```sql
   SELECT id, name, telegramChatId FROM "Physiotherapist";
   ```
2. Verifique configurações no painel administrativo
3. Verifique logs de erro:
   ```sql
   SELECT * FROM "NotificationLog" WHERE status = 'failed';
   ```

### Problema: Cron job não executa

**Causa:** Secret incorreto ou URL errada

**Solução:**
1. Verifique se `CRON_SECRET` está configurado
2. Teste manualmente:
   ```bash
   curl -H "Authorization: Bearer SEU_CRON_SECRET" \
     https://fisio.furquim.cloud/api/cron/notify-shifts
   ```
3. Verifique logs do cron-job.org

### Problema: Erro 401 no cron

**Causa:** Header de autorização incorreto

**Solução:**
```bash
# Formato correto
Authorization: Bearer SEU_SECRET_AQUI

# NÃO use
Authorization: SEU_SECRET_AQUI
```

### Problema: Mensagem não formatada

**Causa:** Variáveis incorretas no template

**Solução:**
- Use exatamente: `{{name}}`, `{{date}}`, `{{period}}`, `{{team}}`
- Não use: `{name}`, `$name`, `%name%`

---

## 📊 Estatísticas e Monitoramento

### Ver Total de Notificações Enviadas

```sql
SELECT 
  messageType,
  status,
  COUNT(*) as total
FROM "NotificationLog"
GROUP BY messageType, status;
```

### Ver Fisioterapeutas Vinculados

```sql
SELECT 
  COUNT(*) as total_vinculados
FROM "Physiotherapist"
WHERE telegramChatId IS NOT NULL;
```

### Ver Taxa de Sucesso

```sql
SELECT 
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'sent')::numeric / COUNT(*)) * 100,
    2
  ) as taxa_sucesso
FROM "NotificationLog"
WHERE sentAt >= NOW() - INTERVAL '30 days';
```

---

## 🚀 Checklist de Implementação

### Desenvolvimento
- [x] Migration aplicada
- [x] Bot criado no BotFather
- [x] Variáveis de ambiente configuradas
- [ ] Webhook configurado (opcional)
- [ ] Fisioterapeutas vinculados
- [ ] Testes realizados

### Produção
- [ ] Variáveis de ambiente no Coolify
- [ ] Migration aplicada em produção
- [ ] Bot configurado
- [ ] Cron job configurado (cron-job.org)
- [ ] Painel administrativo testado
- [ ] Fisioterapeutas orientados
- [ ] Monitoramento ativo

---

## 📞 Suporte

**Dúvidas sobre o bot:**
- Documentação Telegram: https://core.telegram.org/bots/api
- BotFather: @BotFather no Telegram

**Dúvidas sobre o sistema:**
- Contate o administrador do sistema

---

## 📝 Notas Importantes

⚠️ **Segurança:**
- Nunca compartilhe o `TELEGRAM_BOT_TOKEN`
- Mantenha o `CRON_SECRET` seguro
- Use HTTPS em produção

💡 **Dicas:**
- Teste em desenvolvimento antes de produção
- Monitore os logs regularmente
- Mantenha templates de mensagem claros e objetivos
- Oriente fisioterapeutas sobre como usar o bot

🎯 **Boas Práticas:**
- Envie lembretes em horário adequado (18h é bom)
- Não envie notificações em horários inconvenientes
- Mantenha mensagens curtas e diretas
- Use emojis para melhor visualização

---

**Última atualização:** 11/03/2026  
**Versão do Sistema:** 2.0.0  
**Status:** ✅ Produção
