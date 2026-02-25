#!/bin/bash

# ============================================
# Script de Deploy para VPS Hetzner
# ============================================

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deploy PlantaOfisio - Hetzner VPS${NC}"
echo -e "${GREEN}========================================${NC}"

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Por favor, execute como root ou use sudo${NC}"
    exit 1
fi

# Atualizar sistema
echo -e "${YELLOW}Atualizando sistema...${NC}"
apt-get update && apt-get upgrade -y

# Instalar dependências
echo -e "${YELLOW}Instalando Docker e dependências...${NC}"
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

# Adicionar repositório Docker oficial
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Iniciar Docker
systemctl start docker
systemctl enable docker

# Verificar instalação
echo -e "${GREEN}Docker instalado:${NC}"
docker --version
docker compose version

# Criar diretório da aplicação
APP_DIR="/opt/plantaofisio"
echo -e "${YELLOW}Criando diretório da aplicação em $APP_DIR...${NC}"
mkdir -p $APP_DIR
mkdir -p $APP_DIR/uploads
mkdir -p $APP_DIR/logs

# Configurar firewall
echo -e "${YELLOW}Configurando firewall...${NC}"
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 3000/tcp
ufw allow 5432/tcp
ufw allow 8080/tcp
ufw --force enable

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup inicial concluído!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "1. Clone o repositório ou copie os arquivos para $APP_DIR"
echo "2. Configure o arquivo .env.docker: cp .env.docker.example .env.docker"
echo "3. Edite .env.docker com suas variáveis"
echo "4. Execute: cd $APP_DIR && docker compose up -d"
echo ""
echo -e "${GREEN}Para acessar:${NC}"
echo "- Aplicação: http://$(hostname -I | awk '{print $1}'):3000"
echo "- Banco de dados: postgres://$APP_DIR:5432"
