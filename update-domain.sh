#!/bin/bash

# Script para atualizar domínio da aplicação no Coolify

APP_ID="g48wk8goo88g8k8cw4cs484g"
NEW_DOMAIN="fisio.furquim.cloud"
DB_CONTAINER="jk4ss8ssocc4owows0csw4kg"
DB_PASSWORD="eLE1NPit1YQKnVU1o2QTABzxPZ46v9iAHyTlXWNwUxv6CCco1sFi5nOeCVSEHhKp"

echo "=== Atualizando domínio para $NEW_DOMAIN ==="

# Parar container atual
echo "Parando container atual..."
docker stop $(docker ps -q --filter "name=$APP_ID") 2>/dev/null || true
docker rm $(docker ps -aq --filter "name=$APP_ID") 2>/dev/null || true

# Encontrar o docker-compose.yaml do Coolify
COMPOSE_DIR=$(docker inspect $(docker ps -q --filter "name=$APP_ID" | head -1) 2>/dev/null | grep -o '/artifacts/[^"]*' | head -1 | xargs dirname 2>/dev/null)

if [ -z "$COMPOSE_DIR" ]; then
    echo "Não foi possível encontrar o diretório do docker-compose"
    echo "Por favor, faça o redeploy manualmente no Coolify com estas configurações:"
    echo ""
    echo "Domínio: $NEW_DOMAIN"
    echo "Variáveis de ambiente:"
    echo "  NEXTAUTH_URL=https://$NEW_DOMAIN"
    echo "  NEXT_PUBLIC_APP_URL=https://$NEW_DOMAIN"
    echo "  AUTH_TRUST_HOST=true"
    exit 1
fi

echo "Diretório encontrado: $COMPOSE_DIR"

# Atualizar docker-compose.yaml
if [ -f "$COMPOSE_DIR/docker-compose.yaml" ]; then
    echo "Atualizando docker-compose.yaml..."
    sed -i "s|http://g48wk8goo88g8k8cw4cs484g.187.77.57.122.sslip.io|https://$NEW_DOMAIN|g" "$COMPOSE_DIR/docker-compose.yaml"
    sed -i "s|g48wk8goo88g8k8cw4cs484g.187.77.57.122.sslip.io|$NEW_DOMAIN|g" "$COMPOSE_DIR/docker-compose.yaml"
    
    # Atualizar variáveis de ambiente
    sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://$NEW_DOMAIN|g" "$COMPOSE_DIR/docker-compose.yaml"
    sed -i "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://$NEW_DOMAIN|g" "$COMPOSE_DIR/docker-compose.yaml"
    
    echo "Reiniciando aplicação..."
    cd "$COMPOSE_DIR"
    docker-compose up -d
    
    echo ""
    echo "=== Configuração concluída ==="
    echo "Acesse: https://$NEW_DOMAIN"
    echo ""
else
    echo "Arquivo docker-compose.yaml não encontrado em $COMPOSE_DIR"
    echo "Por favor, faça o redeploy manualmente no Coolify"
fi
