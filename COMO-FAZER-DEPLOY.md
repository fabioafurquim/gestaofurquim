# 🚀 Como Fazer Deploy de Novas Versões

## ✅ Seu Git Está Atualizado

Último commit no GitHub:
```
af1cdb1 - fix: remover output standalone do next.config e adicionar docker-compose ao gitignore
```

Este commit contém todas as correções necessárias para produção.

---

## 📝 Processo de Deploy (Passo a Passo)

### 1️⃣ Desenvolver Localmente

```bash
# Fazer suas alterações no código
# Testar localmente
npm run dev
```

### 2️⃣ Commit e Push

```bash
git add .
git commit -m "feat: descrição da sua alteração"
git push origin main
```

### 3️⃣ Deploy no Coolify

1. Acesse: http://187.77.57.122:8000
2. Login no Coolify
3. Vá em: **Projects → gestao-furquim → Sua aplicação**
4. Clique em **"Redeploy"**
5. Aguarde 3-5 minutos

### 4️⃣ ⚠️ CORRIGIR DOMÍNIO (OBRIGATÓRIO)

**O Coolify tem um bug que reverte o domínio após cada deploy.**

Execute este comando:

```bash
ssh root@187.77.57.122 "bash /root/fix-domain-after-deploy.sh"
```

Ou me chame para executar o script.

---

## 🔄 O Que Acontece em Cada Deploy

✅ **Automático (Coolify faz sozinho):**
- Puxa código novo do GitHub
- Instala dependências (`npm install`)
- Faz build (`npm run build`)
- Cria novo container Docker
- Mantém variáveis de ambiente
- Mantém conexão com banco de dados

❌ **Manual (precisa corrigir):**
- Domínio volta para o temporário
- Precisa executar script de correção

---

## 🛠️ Script de Correção de Domínio

**Localização no servidor:** `/root/fix-domain-after-deploy.sh`

**O que ele faz:**
1. Para o container atual
2. Atualiza `docker-compose.yaml` com domínio correto
3. Configura HTTPS com Let's Encrypt
4. Reinicia aplicação

**Quando usar:**
- Após cada redeploy no Coolify
- Se o site voltar a dar 404/503
- Se o domínio `fisio.furquim.cloud` parar de funcionar

---

## 🗄️ Migrations do Banco de Dados

Se você adicionar/alterar tabelas no Prisma:

```bash
# 1. Criar migration localmente
npx prisma migrate dev --name nome_da_migration

# 2. Commit e push
git add .
git commit -m "feat: adicionar nova tabela X"
git push origin main

# 3. Deploy no Coolify (passo 3 acima)

# 4. Executar migration em produção
ssh root@187.77.57.122
docker exec -it $(docker ps -q --filter "name=g48wk8goo88g8k8cw4cs484g") npx prisma migrate deploy
```

---

## 🐛 Problemas Comuns

### Deploy Falhou
**Solução:** Veja os logs no Coolify → Logs → Application Logs

### Domínio Não Funciona (404/503)
**Solução:** Execute o script de correção de domínio

### Erro de Banco de Dados
**Solução:** Verifique se executou as migrations em produção

### Login Não Funciona
**Solução:** Limpe cookies do navegador e tente novamente

---

## 📊 Verificar Se Está Funcionando

Após o deploy:

1. ✅ Acesse: https://fisio.furquim.cloud
2. ✅ Faça login com: `admin@plantaofisio.com` / `Admin123`
3. ✅ Teste as funcionalidades principais

---

## 🔐 Informações Importantes

**Domínio:** https://fisio.furquim.cloud  
**Servidor:** 187.77.57.122  
**Coolify:** http://187.77.57.122:8000  
**GitHub:** https://github.com/fabioafurquim/gestaofurquim  

**Não altere:**
- Variáveis de ambiente no Coolify (já configuradas)
- Arquivo `next.config.ts` (não adicione `output: 'standalone'`)
- Arquivo `.gitignore` (mantém docker-compose.yml ignorado)

---

## ✅ Checklist de Deploy

- [ ] Código testado localmente
- [ ] Commit e push para GitHub
- [ ] Redeploy no Coolify
- [ ] Aguardar build terminar (3-5 min)
- [ ] **Executar script de correção de domínio** ⚠️
- [ ] Testar login em https://fisio.furquim.cloud
- [ ] Verificar funcionalidades

---

## 💡 Dica

Configure webhook no GitHub para deploy automático:
- Coolify → Configuration → Webhooks
- Copie a URL do webhook
- GitHub → Settings → Webhooks → Add webhook
- Cole a URL e salve

Assim, cada push no `main` faz deploy automaticamente!
(Mas ainda precisa executar o script de correção de domínio)
