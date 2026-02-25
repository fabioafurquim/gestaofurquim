#!/bin/bash

# ============================================
# Script de Deploy Rápido
# Execute na VPS após o setup inicial
# ============================================

set -e

APP_DIR="/opt/plantaofisio"

echo "========================================"
echo "  Deploy PlantaOfisio"
echo "========================================"

# Ir para diretório da aplicação
cd $APP_DIR

# Verificar se .env.docker existe
if [ ! -f .env.docker ]; then
    echo "ERRO: Arquivo .env.docker não encontrado!"
    echo "Copie .env.docker.example para .env.docker e configure as variáveis"
    exit 1
fi

# Carregar variáveis de ambiente
export $(cat .env.docker | grep -v '^#' | xargs)

echo "→ Parando containers antigos..."
docker compose down --remove-orphans 2>/dev/null || true

echo "→ Construindo imagens..."
docker compose build --no-cache

echo "→ Subindo containers..."
docker compose up -d

echo "→ Aguardando banco de dados..."
sleep 10

echo "→ Executando migrações..."
docker compose exec app npx prisma migrate deploy

echo "→ Verificando status..."
docker compose ps

echo ""
echo "========================================"
echo "  Deploy concluído!"
echo "========================================"
echo ""
echo "Aplicação: http://$(hostname -I | awk '{print $1}'):3000"
echo "Logs: docker compose logs -f"
