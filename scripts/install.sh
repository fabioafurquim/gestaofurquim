#!/bin/bash

# ============================================
# Script de Instalação - PlantaOfisio
# Execute este script DIRETAMENTE no servidor
# ============================================

set -e

echo "========================================"
echo "  Instalação PlantaOfisio"
echo "========================================"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Atualizar sistema
echo -e "${YELLOW}[1/7] Atualizando sistema...${NC}"
apt-get update -qq

# 2. Instalar Docker
echo -e "${YELLOW}[2/7] Instalando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi
docker --version

# 3. Criar diretórios
echo -e "${YELLOW}[3/7] Criando diretórios...${NC}"
mkdir -p /opt/plantaofisio
mkdir -p /opt/plantaofisio/uploads
mkdir -p /opt/plantaofisio/logs
cd /opt/plantaofisio

# 4. Verificar se há arquivos do projeto
echo -e "${YELLOW}[4/7] Verificando arquivos...${NC}"
if [ ! -f "docker-compose.yml" ]; then
    echo "ERRO: Arquivos do projeto não encontrados!"
    echo "Por favor, copie os arquivos primeiro usando:"
    echo "  scp plantaofisio-deploy.zip root@46.225.232.16:/opt/plantaofisio/"
    exit 1
fi

# 5. Configurar firewall
echo -e "${YELLOW}[5/7] Configurando firewall...${NC}"
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 3000/tcp
ufw allow 5432/tcp
ufw --force enable

# 6. Criar .env.docker se não existir
echo -e "${YELLOW}[6/7] Configurando ambiente...${NC}"
if [ ! -f ".env.docker" ]; then
    cat > .env.docker << 'EOF'
# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=plantaofisio
DB_USER=postgres
DB_PASSWORD=G@bi110605

# PostgreSQL Connection URLs
DATABASE_URL=postgresql://postgres:G@bi110605@postgres:5432/plantaofisio
DIRECT_URL=postgresql://postgres:G@bi110605@postgres:5432/plantaofisio

# JWT Secret
JWT_SECRET=plantaofisio-secret-key-2026-production

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://46.225.232.16:3000/api/auth/google/callback

# App Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=http://46.225.232.16:3000
UPLOAD_DIR=/app/uploads
EOF
    echo "Arquivo .env.docker criado"
fi

# 7. Iniciar aplicação
echo -e "${YELLOW}[7/7] Iniciando aplicação...${NC}"
docker compose down 2>/dev/null || true
docker compose up -d --build

echo ""
echo "========================================"
echo -e "${GREEN}Instalação concluída!${NC}"
echo "========================================"
echo ""
echo "Acesse: http://46.225.232.16:3000"
echo ""
echo "Comandos úteis:"
echo "  docker compose logs -f    # Ver logs"
echo "  docker compose ps         # Ver status"
echo "  docker compose down       # Parar"
echo "  docker compose up -d      # Iniciar"
echo ""
