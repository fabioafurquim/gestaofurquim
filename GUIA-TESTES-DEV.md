# 🧪 Guia de Testes - Ambiente de Desenvolvimento (Windows)

**Data:** 11/03/2026  
**Ambiente:** Windows + localhost:3000  

---

## 📋 Pré-requisitos

- [x] Bot criado no Telegram (@BotFather)
- [x] Variáveis configuradas no `.env.local`:
  - `TELEGRAM_BOT_TOKEN`
  - `CRON_SECRET`
- [ ] Servidor dev rodando: `npm run dev`
- [ ] Extensão REST Client instalada no VS Code (opcional)

---

## 🎯 SOLUÇÃO DE CRON PARA DESENVOLVIMENTO

### ✅ Opção Recomendada: Teste Manual

**Por que?**
- ✅ Mais simples e rápido
- ✅ Controle total sobre quando testar
- ✅ Não precisa de serviços externos
- ✅ Perfeito para desenvolvimento

**Como usar:**

#### Método 1: Arquivo `test-notifications.http` (RECOMENDADO)

1. Instale a extensão **REST Client** no VS Code
2. Abra o arquivo `test-notifications.http`
3. Clique em **"Send Request"** acima de cada requisição
4. Veja o resultado direto no VS Code

#### Método 2: PowerShell

```powershell
# Testar notificações diárias
$headers = @{
    "Authorization" = "Bearer SEU_CRON_SECRET_AQUI"
}
Invoke-WebRequest -Uri "http://localhost:3000/api/cron/notify-shifts" -Headers $headers -Method GET
```

#### Método 3: cURL (Git Bash ou WSL)

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" \
  http://localhost:3000/api/cron/notify-shifts
```

---

## 🧪 ROTEIRO DE TESTES COMPLETO

### Teste 1: Verificar Bot Telegram ✅

**Objetivo:** Confirmar que o bot está funcionando

**Passos:**
1. Abra o Telegram
2. Busque seu bot: `@seu_bot_aqui`
3. Clique em **START**
4. Envie: `/start`
5. **Resultado esperado:** Bot responde com instruções de vinculação

**Comandos para testar:**
```
/start  → Deve mostrar instruções e seu Chat ID
/status → Deve dizer "não vinculado" ainda
/help   → Deve mostrar lista de comandos
```

---

### Teste 2: Acessar Painel Administrativo ✅

**Objetivo:** Verificar se o painel está acessível

**Passos:**
1. Acesse: http://localhost:3000/notifications
2. Faça login como ADMIN
3. **Resultado esperado:** Painel de configurações carrega

**Verificar:**
- [ ] Toggle master funciona
- [ ] Seletor de horário funciona
- [ ] Editores de template funcionam
- [ ] Botão "Salvar" funciona
- [ ] Mensagem de sucesso aparece

---

### Teste 3: Configurar Notificações ✅

**Objetivo:** Definir configurações iniciais

**Passos:**
1. No painel `/notifications`:
   - Habilite "Sistema de Notificações"
   - Habilite "Lembrete Diário"
   - Configure horário: 18:00
   - Habilite "Notificação Instantânea"
   - Mantenha templates padrão (ou personalize)
2. Clique em **"Salvar Configurações"**
3. **Resultado esperado:** "Configurações salvas com sucesso!"

---

### Teste 4: Vincular Fisioterapeuta ao Telegram ✅

**Objetivo:** Conectar fisioterapeuta ao bot

**Passos:**

#### 4.1: Obter Chat ID
1. Fisioterapeuta abre bot no Telegram
2. Envia `/start`
3. Bot responde com o Chat ID (ex: `123456789`)
4. Copie o Chat ID

#### 4.2: Vincular via API

**Opção A: Usando REST Client (test-notifications.http)**
```http
POST http://localhost:3000/api/telegram/link
Content-Type: application/json

{
  "physiotherapistId": 1,
  "chatId": "123456789",
  "username": "nome_usuario"
}
```

**Opção B: Usando PowerShell**
```powershell
$body = @{
    physiotherapistId = 1
    chatId = "123456789"
    username = "nome_usuario"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/telegram/link" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

#### 4.3: Verificar Vinculação
1. Fisioterapeuta envia `/status` no bot
2. **Resultado esperado:** "✅ Sua conta está vinculada!"

---

### Teste 5: Notificação Instantânea ✅

**Objetivo:** Testar notificação ao criar plantão

**Pré-requisito:** Fisioterapeuta vinculado (Teste 4)

**Passos:**
1. Acesse o sistema
2. Vá em **Plantões**
3. Cadastre um novo plantão para o fisioterapeuta vinculado
4. **Resultado esperado:** 
   - Plantão criado com sucesso
   - Fisioterapeuta recebe notificação no Telegram imediatamente

**Verificar mensagem:**
```
✅ Novo Plantão Cadastrado

Olá, [Nome]!

Você foi escalado para:

📅 Data: [Data]
⏰ Período: [Período]
🏢 Equipe: [Equipe]

Confira no sistema!
```

---

### Teste 6: Notificação Diária (Manual) ✅

**Objetivo:** Testar lembrete 1 dia antes

**Pré-requisitos:**
- Fisioterapeuta vinculado
- Plantão cadastrado para AMANHÃ

**Passos:**

#### 6.1: Criar Plantão para Amanhã
1. Cadastre um plantão para a data de **amanhã**
2. Atribua ao fisioterapeuta vinculado

#### 6.2: Executar Cron Manualmente

**Usando REST Client (test-notifications.http):**
```http
GET http://localhost:3000/api/cron/notify-shifts
Authorization: Bearer {{$dotenv CRON_SECRET}}
```

**Usando PowerShell:**
```powershell
$headers = @{
    "Authorization" = "Bearer SEU_CRON_SECRET"
}
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/cron/notify-shifts" -Headers $headers
$response.Content | ConvertFrom-Json
```

#### 6.3: Verificar Resposta
**Resposta esperada:**
```json
{
  "message": "Notificações processadas",
  "total": 1,
  "sent": 1,
  "failed": 0,
  "timestamp": "2026-03-11T18:00:00.000Z"
}
```

#### 6.4: Verificar Telegram
Fisioterapeuta deve receber:
```
🏥 Lembrete de Plantão

Olá, [Nome]! 👋

Você está escalado para amanhã:

📅 Data: [Data]
⏰ Período: [Período]
🏢 Equipe: [Equipe]

Boa sorte! 💪
```

---

### Teste 7: Verificar Logs no Banco ✅

**Objetivo:** Confirmar que notificações foram registradas

**Query SQL:**
```sql
-- Ver últimas notificações
SELECT 
  nl.id,
  p.name as fisioterapeuta,
  nl.messageType,
  nl.status,
  nl.sentAt,
  nl.errorMessage
FROM "NotificationLog" nl
JOIN "Physiotherapist" p ON p.id = nl.physiotherapistId
ORDER BY nl.sentAt DESC
LIMIT 10;
```

**Executar via Prisma Studio:**
```bash
npx prisma studio
# Abra a tabela NotificationLog
```

**Verificar:**
- [ ] Logs de `instant_notification` (ao criar plantão)
- [ ] Logs de `daily_reminder` (ao executar cron)
- [ ] Status = `sent` (sucesso)
- [ ] Sem `errorMessage`

---

### Teste 8: Testar Erros e Edge Cases ✅

#### 8.1: Fisioterapeuta Sem Telegram
1. Crie plantão para fisioterapeuta NÃO vinculado
2. Execute cron manual
3. **Resultado esperado:** 
   - Resposta: `total: 1, sent: 0, failed: 0`
   - Log no console: "Fisioterapeuta X não tem Telegram vinculado"

#### 8.2: Notificações Desabilitadas
1. No painel, desabilite "Sistema de Notificações"
2. Crie um plantão
3. **Resultado esperado:** Nenhuma notificação enviada

#### 8.3: Token Inválido
1. Configure `TELEGRAM_BOT_TOKEN` inválido no `.env.local`
2. Tente criar plantão
3. **Resultado esperado:** 
   - Plantão criado normalmente
   - Notificação falha silenciosamente
   - Log de erro no console

---

## 📊 Checklist de Testes

### Configuração Inicial
- [ ] Bot criado no Telegram
- [ ] Variáveis no `.env.local` configuradas
- [ ] Servidor dev rodando
- [ ] Painel administrativo acessível

### Funcionalidades
- [ ] Bot responde comandos (`/start`, `/status`, `/help`)
- [ ] Painel salva configurações
- [ ] Vinculação de fisioterapeuta funciona
- [ ] Notificação instantânea enviada ao criar plantão
- [ ] Notificação diária enviada via cron manual
- [ ] Logs registrados no banco

### Edge Cases
- [ ] Fisioterapeuta sem Telegram não recebe notificação
- [ ] Sistema desabilitado não envia notificações
- [ ] Erros são tratados graciosamente

---

## 🐛 Troubleshooting

### Problema: Bot não responde
**Solução:**
```bash
# Testar token
curl "https://api.telegram.org/botSEU_TOKEN/getMe"
```

### Problema: Erro 401 no cron
**Solução:**
- Verifique se `CRON_SECRET` no `.env.local` está correto
- Header deve ser: `Authorization: Bearer SEU_SECRET`

### Problema: Notificação não enviada
**Verificar:**
1. Fisioterapeuta tem `telegramChatId`?
   ```sql
   SELECT id, name, telegramChatId FROM "Physiotherapist";
   ```
2. Notificações estão habilitadas no painel?
3. Logs de erro:
   ```sql
   SELECT * FROM "NotificationLog" WHERE status = 'failed';
   ```

### Problema: Painel não carrega
**Solução:**
- Verifique se está logado como ADMIN
- Limpe cache do navegador
- Verifique console do navegador (F12)

---

## 🎯 Próximos Passos Após Testes

Quando tudo estiver funcionando em dev:

1. **Commit das alterações** (se houver ajustes)
2. **Push para GitHub**
3. **Configurar produção:**
   - Variáveis no Coolify
   - Aplicar migration
   - Configurar cron-job.org
4. **Testar em produção**
5. **Vincular fisioterapeutas reais**
6. **Monitorar por 1 semana**

---

## 📝 Notas

**Dica:** Use o arquivo `test-notifications.http` para todos os testes. É muito mais prático que PowerShell ou cURL.

**Importante:** Em desenvolvimento, você precisa executar o cron **manualmente** quando quiser testar. Não há cron automático no Windows para localhost.

**Lembrete:** Plantões para "amanhã" são aqueles cuja data é exatamente D+1 (amanhã às 00:00).

---

**Boa sorte com os testes! 🚀**
