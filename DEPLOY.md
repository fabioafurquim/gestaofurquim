# 🚀 Guia de Deploy - Plantão Fisio

## 📋 Índice
- [Visão Geral](#visão-geral)
- [Instalação do Coolify](#instalação-do-coolify)
- [Configuração do Projeto](#configuração-do-projeto)
- [Deploy via Git](#deploy-via-git)
- [Múltiplas Aplicações](#múltiplas-aplicações)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

### Arquitetura de Deploy

```
GitHub/GitLab
    ↓ (git push)
Coolify (VPS)
    ↓
Docker Containers
    ├── App 1 (plantaofisio) → porta 80
    ├── App 2 (outra-app) → porta 81
    └── PostgreSQL (compartilhado)
```

### Tecnologias
- **Coolify** - Plataforma de deploy open-source (alternativa ao Vercel/Netlify)
- **Docker** - Containerização
- **Nginx** - Reverse proxy (gerenciado pelo Coolify)
- **PostgreSQL** - Banco de dados

---

## Instalação do Coolify

### Pré-requisitos do Servidor
- VPS com Ubuntu 22.04+ ou Debian 11+
- Mínimo 2GB RAM (4GB recomendado)
- 20GB de espaço em disco
- IP público
- Domínio apontado para o IP (opcional mas recomendado)

### 1. Instalar Coolify no VPS

**SSH no servidor:**
```bash
ssh root@187.77.57.122
```

**Executar instalação do Coolify:**
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

**Aguarde a instalação (5-10 minutos)**

### 2. Acessar Coolify

Após a instalação, acesse:
```
http://187.77.57.122:8000
```

**Primeiro acesso:**
1. Crie uma conta de administrador
2. Configure o email (opcional)
3. Aceite os termos

---

## Configuração do Projeto

### 1. Criar Novo Projeto no Coolify

1. **Dashboard → Projects → Create New Project**
   - Nome: `Plantão Fisio`
   - Descrição: `Sistema de Gestão de Plantões`

2. **Add Resource → Git Repository**
   - Repository URL: `https://github.com/seu-usuario/plantaofisio.git`
   - Branch: `main`
   - Build Pack: `nixpacks` (detecta Next.js automaticamente)

### 2. Configurar Variáveis de Ambiente

**Environment → Add Variable:**

```env
# Database
DATABASE_URL=postgresql://postgres:Fmm20615@postgres:5432/plantaofisio
DIRECT_URL=postgresql://postgres:Fmm20615@postgres:5432/plantaofisio

# Auth
AUTH_SECRET=plantaofisio-production-secret-2026
JWT_SECRET=plantaofisio-production-secret-2026
NODE_ENV=production

# App
NEXT_PUBLIC_APP_URL=http://furquim.cloud
```

### 3. Configurar PostgreSQL

**Add Resource → Database → PostgreSQL**
- Nome: `plantaofisio-db`
- Versão: `15`
- Senha: `Fmm20615`
- Porta: `5432`

**Conectar ao projeto:**
- Link database to application
- Variável: `DATABASE_URL`

### 4. Configurar Domínio

**Settings → Domains:**
- Adicionar: `furquim.cloud`
- Adicionar: `www.furquim.cloud`

**SSL/HTTPS (Automático):**
- Coolify gera certificado Let's Encrypt automaticamente
- Redirect HTTP → HTTPS: ✅ Ativado

---

## Deploy via Git

### Configuração Inicial

**1. Adicionar repositório Git remoto:**
```bash
git remote add origin https://github.com/seu-usuario/plantaofisio.git
```

**2. Criar arquivo `.coolify.yaml` (opcional):**
```yaml
# .coolify.yaml
version: '1.0'
build:
  command: npm run build
  output: .next
start:
  command: npm start
healthcheck:
  path: /api/health
  interval: 30s
  timeout: 10s
  retries: 3
```

### Deploy Automático

**Toda vez que você fizer push:**
```bash
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
```

**Coolify automaticamente:**
1. ✅ Detecta o push
2. ✅ Faz pull do código
3. ✅ Instala dependências
4. ✅ Executa build
5. ✅ Executa migrações Prisma
6. ✅ Reinicia a aplicação
7. ✅ Zero downtime

### Deploy Manual

**Via Coolify Dashboard:**
1. Project → Deployments
2. Click "Deploy"
3. Aguarde o build

---

## 🔄 Múltiplas Aplicações no Mesmo Servidor

### Estratégia Recomendada

**Estrutura:**
```
VPS (187.77.57.122)
├── Coolify (porta 8000)
├── PostgreSQL (compartilhado)
├── App 1: plantaofisio
│   ├── Domínio: furquim.cloud
│   └── Porta: 3000 (interna)
└── App 2: outra-app
    ├── Domínio: outra.furquim.cloud
    └── Porta: 3001 (interna)
```

### Configurar Segunda Aplicação

**1. Criar novo projeto no Coolify:**
```
Projects → Create New Project
Nome: Outra App
```

**2. Adicionar repositório Git:**
```
Add Resource → Git Repository
URL: https://github.com/seu-usuario/outra-app.git
```

**3. Usar o mesmo PostgreSQL:**
```
Link existing database: plantaofisio-db
```

**4. Configurar subdomínio:**
```
Domains → Add: outra.furquim.cloud
```

### Compartilhar Recursos

**PostgreSQL Compartilhado:**
- Ambas apps usam o mesmo banco
- Schemas separados ou databases diferentes:
```sql
CREATE DATABASE plantaofisio;
CREATE DATABASE outra_app;
```

**Nginx (gerenciado pelo Coolify):**
- Coolify configura automaticamente
- Cada app tem seu próprio domínio/subdomínio

---

## 🔐 Segurança

### Firewall

```bash
# Permitir apenas portas necessárias
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 8000/tcp  # Coolify (temporário, depois fechar)
ufw enable
```

### SSL/HTTPS

Coolify configura automaticamente com Let's Encrypt:
- Certificados renovados automaticamente
- Redirect HTTP → HTTPS
- HSTS habilitado

### Backup Automático

**Configurar no Coolify:**
1. Settings → Backups
2. Enable Database Backups
3. Frequência: Diária
4. Retenção: 7 dias
5. Destino: S3/Local

---

## 📊 Monitoramento

### Logs em Tempo Real

**Via Coolify:**
```
Project → Logs → Live Logs
```

**Via SSH:**
```bash
# Logs da aplicação
docker logs -f <container-name>

# Logs do PostgreSQL
docker logs -f plantaofisio-db
```

### Métricas

**Coolify Dashboard:**
- CPU Usage
- Memory Usage
- Disk Usage
- Network Traffic

### Alertas

**Configurar notificações:**
1. Settings → Notifications
2. Add Webhook/Email
3. Eventos: Deploy failed, High CPU, etc.

---

## 🐛 Troubleshooting

### Deploy Falhou

**1. Verificar logs:**
```
Deployments → Failed → View Logs
```

**2. Erros comuns:**

**Erro: "Build failed"**
```bash
# Verificar se o build funciona localmente
npm run build
```

**Erro: "Database connection failed"**
```bash
# Verificar variáveis de ambiente
# Verificar se PostgreSQL está rodando
docker ps | grep postgres
```

**Erro: "Port already in use"**
```bash
# Coolify gerencia portas automaticamente
# Verificar configuração de portas no projeto
```

### Aplicação Não Responde

**1. Verificar status do container:**
```bash
docker ps -a
```

**2. Reiniciar aplicação:**
```
Coolify → Project → Restart
```

**3. Verificar logs:**
```bash
docker logs <container-name> --tail 100
```

### Banco de Dados

**Conectar via psql:**
```bash
docker exec -it plantaofisio-db psql -U postgres -d plantaofisio
```

**Backup manual:**
```bash
docker exec plantaofisio-db pg_dump -U postgres plantaofisio > backup.sql
```

**Restore:**
```bash
docker exec -i plantaofisio-db psql -U postgres plantaofisio < backup.sql
```

---

## 🔄 Rollback

### Reverter para Versão Anterior

**Via Coolify:**
1. Deployments → History
2. Selecionar versão anterior
3. Click "Redeploy"

**Via Git:**
```bash
git revert HEAD
git push origin main
```

---

## 📈 Escalabilidade

### Quando Escalar

**Sinais:**
- CPU > 80% constantemente
- Memory > 90%
- Response time > 1s
- Muitos usuários simultâneos

### Opções de Escalabilidade

**1. Vertical (Upgrade do VPS):**
- Mais CPU/RAM no mesmo servidor
- Mais simples
- Limite físico

**2. Horizontal (Múltiplos Servidores):**
- Load balancer
- Múltiplas instâncias da app
- Mais complexo mas escalável

**3. Database Scaling:**
- Read replicas
- Connection pooling
- Índices otimizados

---

## 📚 Recursos

- [Coolify Docs](https://coolify.io/docs)
- [Docker Docs](https://docs.docker.com/)
- [Next.js Deploy](https://nextjs.org/docs/deployment)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

## 🆘 Suporte

**Problemas com Coolify:**
- [GitHub Issues](https://github.com/coollabsio/coolify/issues)
- [Discord](https://discord.gg/coolify)

**Problemas com a Aplicação:**
- Verificar logs
- Consultar DEV.md
- Contatar desenvolvedor

---

## ✅ Checklist de Deploy

- [ ] Coolify instalado e configurado
- [ ] Projeto criado no Coolify
- [ ] Repositório Git conectado
- [ ] Variáveis de ambiente configuradas
- [ ] PostgreSQL criado e conectado
- [ ] Domínio configurado
- [ ] SSL/HTTPS ativado
- [ ] Primeiro deploy bem-sucedido
- [ ] Aplicação acessível via domínio
- [ ] Login funcionando
- [ ] Backup configurado
- [ ] Monitoramento ativo

---

## 🎉 Pronto!

Agora você tem:
- ✅ Deploy automático via Git push
- ✅ SSL/HTTPS automático
- ✅ Zero downtime
- ✅ Rollback fácil
- ✅ Monitoramento integrado
- ✅ Suporte para múltiplas apps

**Próximo deploy:**
```bash
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
```

E pronto! Coolify faz o resto automaticamente! 🚀
