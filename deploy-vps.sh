#!/bin/bash
set -e

echo "🚀 Iniciando deploy da aplicação Plantão Fisio..."

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
APP_DIR="/root/plantaofisio"
REPO_URL="https://github.com/fabioafurquim/gestaofurquim.git"
BRANCH="main"

echo -e "${BLUE}📦 Passo 1: Clonando/Atualizando repositório...${NC}"
if [ -d "$APP_DIR" ]; then
    cd $APP_DIR
    git pull origin $BRANCH
else
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

echo -e "${BLUE}📝 Passo 2: Criando arquivo .env de produção...${NC}"
cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://postgres:Fmm20615@postgres:5432/plantaofisio"
DIRECT_URL="postgresql://postgres:Fmm20615@postgres:5432/plantaofisio"

# Auth
AUTH_SECRET="plantaofisio-production-secret-2026"
JWT_SECRET="plantaofisio-production-secret-2026"
NEXTAUTH_URL="http://187.77.57.122:3000"

# App
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="http://187.77.57.122:3000"
EOF

echo -e "${BLUE}🐳 Passo 3: Criando docker-compose.yml...${NC}"
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: plantaofisio-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: Fmm20615
      POSTGRES_DB: plantaofisio
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - plantaofisio-network

  app:
    build:
      context: .
      dockerfile: Dockerfile.production
    container_name: plantaofisio-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:Fmm20615@postgres:5432/plantaofisio
      - DIRECT_URL=postgresql://postgres:Fmm20615@postgres:5432/plantaofisio
      - AUTH_SECRET=plantaofisio-production-secret-2026
      - JWT_SECRET=plantaofisio-production-secret-2026
      - NEXTAUTH_URL=http://187.77.57.122:3000
      - NODE_ENV=production
      - NEXT_PUBLIC_APP_URL=http://187.77.57.122:3000
    depends_on:
      - postgres
    networks:
      - plantaofisio-network

volumes:
  postgres_data:

networks:
  plantaofisio-network:
    driver: bridge
EOF

echo -e "${BLUE}🔨 Passo 4: Parando containers antigos (se existirem)...${NC}"
docker-compose down || true

echo -e "${BLUE}🏗️  Passo 5: Construindo e iniciando aplicação...${NC}"
docker-compose up -d --build

echo -e "${BLUE}⏳ Aguardando PostgreSQL iniciar...${NC}"
sleep 10

echo -e "${BLUE}🗄️  Passo 6: Executando migrações do Prisma...${NC}"
docker-compose exec -T app npx prisma migrate deploy

echo -e "${BLUE}🌱 Passo 7: Gerando Prisma Client...${NC}"
docker-compose exec -T app npx prisma generate

echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo -e "${GREEN}🌐 Aplicação disponível em: http://187.77.57.122:3000${NC}"
echo ""
echo "📋 Comandos úteis:"
echo "  - Ver logs: docker-compose logs -f app"
echo "  - Parar: docker-compose down"
echo "  - Reiniciar: docker-compose restart"
echo "  - Status: docker-compose ps"
