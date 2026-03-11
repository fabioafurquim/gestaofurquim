# 🚀 Teste Rápido - Notificações Telegram

## 📋 Checklist Rápido

### 1. Configurar Variáveis de Ambiente

Adicione ao seu `.env.local`:

```env
# Telegram Bot (token do @BotFather)
TELEGRAM_BOT_TOKEN="seu-token-aqui"

# Cron Secret (pode ser qualquer string)
CRON_SECRET="meu-secret-dev-123"
NEXT_PUBLIC_CRON_SECRET="meu-secret-dev-123"
```

### 2. Iniciar Servidor

```bash
npm run dev
```

### 3. Acessar Configurações

1. Abra: http://localhost:3000/settings
2. Faça login como ADMIN
3. Role até a seção **"🤖 Notificações Telegram"**

### 4. Configurar Notificações

- ✅ Habilite "Sistema de Notificações"
- ✅ Habilite "Notificação ao Criar Plantão"
- ✅ Habilite "Notificação Automática (1 dia antes)"

### 5. Vincular Fisioterapeuta (Teste)

#### 5.1: Obter Chat ID
1. Abra o Telegram
2. Busque seu bot: `@seu_bot_aqui`
3. Envie: `/start`
4. Copie o Chat ID que aparece

#### 5.2: Vincular via REST Client
1. Abra `test-notifications.http` no VS Code
2. Edite a seção "Vincular Fisioterapeuta":
   ```http
   POST http://localhost:3000/api/telegram/link
   Content-Type: application/json

   {
     "physiotherapistId": 1,
     "chatId": "SEU_CHAT_ID_AQUI",
     "username": "seu_username"
   }
   ```
3. Clique em "Send Request"

### 6. Testar Notificação Instantânea

1. Vá em **Plantões**
2. Cadastre um novo plantão para o fisioterapeuta vinculado
3. ✅ Você deve receber notificação no Telegram imediatamente!

### 7. Testar Notificação Automática (Manual)

#### 7.1: Criar Plantão para Amanhã
1. Cadastre um plantão para a data de **AMANHÃ**
2. Atribua ao fisioterapeuta vinculado

#### 7.2: Executar Teste Manual
1. Volte em **Configurações** (http://localhost:3000/settings)
2. Role até "Notificações Telegram"
3. Clique no botão **"Testar Notificações Automáticas Agora"**
4. ✅ Aguarde o resultado aparecer
5. ✅ Veja os logs logo abaixo
6. ✅ Verifique se recebeu notificação no Telegram

### 8. Verificar Resultado

**Se tudo funcionou:**
- ✅ Resultado mostra: "X notificação(ões) enviada(s) com sucesso!"
- ✅ Logs aparecem com ✅ verde
- ✅ Fisioterapeuta recebeu mensagem no Telegram

**Se não houver plantões para amanhã:**
- ℹ️ Mensagem: "Nenhum plantão encontrado para amanhã"

**Se houver erro:**
- ❌ Verifique se `TELEGRAM_BOT_TOKEN` está correto
- ❌ Verifique se fisioterapeuta tem `telegramChatId` vinculado

---

## 🔍 Troubleshooting Rápido

### Bot não responde
```bash
# Testar token
curl "https://api.telegram.org/botSEU_TOKEN/getMe"
```

### Erro ao testar notificações
- Verifique se `NEXT_PUBLIC_CRON_SECRET` está no `.env.local`
- Reinicie o servidor: `Ctrl+C` e `npm run dev`

### Fisioterapeuta não recebe notificação
```sql
-- Verificar se está vinculado
SELECT id, name, telegramChatId FROM "Physiotherapist";
```

---

## ✅ Pronto!

Se tudo funcionou, você está pronto para usar o sistema! 🎉

**Próximos passos:**
- Vincular mais fisioterapeutas
- Testar com plantões reais
- Quando estiver OK, fazer deploy em produção
