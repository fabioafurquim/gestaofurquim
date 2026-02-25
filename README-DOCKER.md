# 🐳 Docker Deployment - PlantaOfisio

Guia completo para deploy da aplicação PlantaOfisio usando Docker no VPS Hetzner.

## 📋 Estrutura de Arquivos

```
plantaofisio/
├── Dockerfile              # Build da aplicação Next.js
├── docker-compose.yml      # Orquestração app + postgres
├── .env.docker.example     # Template de variáveis de produção
├── scripts/
│   ├── setup-vps.sh       # Setup inicial do servidor
│   └── deploy.sh          # Deploy rápido
└── README-DOCKER.md       # Este arquivo
```

## 🚀 Primeiro Deploy (Setup Completo)

### 1. Conectar no servidor via SSH

```bash
ssh root@SEU-IP-HETZNER
```

### 2. Clonar ou copiar arquivos para o servidor

Opção A - Clonar do Git:
```bash
cd /opt
git clone https://github.com/seu-usuario/plantaofisio.git
cd plantaofisio
```

Opção B - Upload via SCP (do seu Windows):
```powershell
# No PowerShell do Windows:
scp -r c:\htdocs\plantaofisio\ root@SEU-IP-HETZNER:/opt/
```

### 3. Executar setup inicial

```bash
cd /opt/plantaofisio
chmod +x scripts/*.sh
./scripts/setup-vps.sh
```

### 4. Configurar variáveis de ambiente

```bash
cp .env.docker.example .env.docker
nano .env.docker  # ou vi .env.docker
```

**Edite as seguintes variáveis:**
- `DB_PASSWORD` - Senha forte para PostgreSQL
- `JWT_SECRET` - Chave secreta para tokens (use: `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` - OAuth do Google
- `GOOGLE_REDIRECT_URI` - Use o IP da VPS

### 5. Subir a aplicação

```bash
./scripts/deploy.sh
```

## 🔄 Deploys Seguintes (Atualizações)

```bash
ssh root@SEU-IP-HETZNER
cd /opt/plantaofisio
git pull  # Se usar git
./scripts/deploy.sh
```

## 🛠️ Comandos Úteis

### Ver logs
```bash
docker compose logs -f          # Todos os logs
docker compose logs -f app      # Apenas aplicação
docker compose logs -f postgres # Apenas banco
```

### Reiniciar
```bash
docker compose restart
docker compose restart app
```

### Parar tudo
```bash
docker compose down
```

### Backup do banco
```bash
docker compose exec postgres pg_dump -U postgres plantaofisio > backup_$(date +%Y%m%d).sql
```

### Acessar banco via terminal
```bash
docker compose exec postgres psql -U postgres -d plantaofisio
```

## 🔒 Configurações de Segurança

### Firewall (UFW)
- Porta 22 (SSH) - Aberta
- Porta 3000 (App) - Aberta
- Porta 5432 (PostgreSQL) - Fechada para externos (só acesso interno)
- Porta 8080 (pgAdmin opcional) - Fechada ou restrita

### Variáveis Sensíveis
- Nunca commit o arquivo `.env.docker`
- Use senhas fortes (mínimo 16 caracteres)
- JWT_SECRET deve ser único por instalação

## 📦 Ambiente de Desenvolvimento (Windows Local)

Continue usando como antes:
```powershell
# Windows local
npm run dev
```

O banco PostgreSQL local continua funcionando normalmente.

## 🆘 Troubleshooting

### Erro "Connection refused" no banco
```bash
# Verificar se postgres está rodando
docker compose ps

# Restart no banco
docker compose restart postgres

# Ver logs
docker compose logs postgres
```

### Erro de permissão no uploads
```bash
docker compose exec app chown -R nextjs:nodejs /app/uploads
```

### Limpar tudo e começar do zero
```bash
docker compose down -v  # Remove volumes também
docker system prune -f  # Limpa imagens não usadas
```

## 📞 URLs de Acesso

Após deploy:
- **Aplicação:** http://SEU-IP-HETZNER:3000
- **pgAdmin (se habilitado):** http://SEU-IP-HETZNER:8080
  - Email: admin@plantaofisio.com
  - Senha: admin123

---

## 📝 Checklist Pré-Deploy

- [ ] Configurar `.env.docker` com dados reais
- [ ] Atualizar `GOOGLE_REDIRECT_URI` com IP da VPS
- [ ] Gerar `JWT_SECRET` forte
- [ ] Configurar senha forte do PostgreSQL
- [ ] Testar build local: `docker compose build`
- [ ] Verificar se uploads/ está no .gitignore
