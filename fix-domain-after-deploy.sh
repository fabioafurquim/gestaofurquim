#!/bin/bash
# Script para corrigir domínio após deploy do Coolify
# Execute este script após cada redeploy no Coolify

echo "=== Corrigindo domínio fisio.furquim.cloud após deploy ==="

# Parar container atual
echo "Parando container..."
docker stop $(docker ps -q --filter "name=g48wk8goo88g8k8cw4cs484g") 2>/dev/null

# Atualizar docker-compose.yaml
echo "Atualizando configuração de domínio..."
sed -i 's|g48wk8goo88g8k8cw4cs484g.187.77.57.122.sslip.io|fisio.furquim.cloud|g' /data/coolify/applications/g48wk8goo88g8k8cw4cs484g/docker-compose.yaml
sed -i 's|http://fisio.furquim.cloud|https://fisio.furquim.cloud|g' /data/coolify/applications/g48wk8goo88g8k8cw4cs484g/docker-compose.yaml

# Verificar se as rotas HTTPS existem, se não, adicionar
if ! grep -q "https-0-g48wk8goo88g8k8cw4cs484g.tls.certresolver" /data/coolify/applications/g48wk8goo88g8k8cw4cs484g/docker-compose.yaml; then
    echo "Adicionando configuração HTTPS..."
    # Adicionar rotas HTTPS se não existirem
    sed -i '/traefik.http.routers.http-0-g48wk8goo88g8k8cw4cs484g.service/a\            - traefik.http.routers.https-0-g48wk8goo88g8k8cw4cs484g.entryPoints=https\n            - traefik.http.routers.https-0-g48wk8goo88g8k8cw4cs484g.middlewares=gzip\n            - traefik.http.routers.https-0-g48wk8goo88g8k8cw4cs484g.rule=Host(`fisio.furquim.cloud`)\n            - traefik.http.routers.https-0-g48wk8goo88g8k8cw4cs484g.service=http-0-g48wk8goo88g8k8cw4cs484g\n            - traefik.http.routers.https-0-g48wk8goo88g8k8cw4cs484g.tls=true\n            - traefik.http.routers.https-0-g48wk8goo88g8k8cw4cs484g.tls.certresolver=letsencrypt' /data/coolify/applications/g48wk8goo88g8k8cw4cs484g/docker-compose.yaml
fi

# Reiniciar aplicação
echo "Reiniciando aplicação..."
cd /data/coolify/applications/g48wk8goo88g8k8cw4cs484g
docker compose up -d

echo ""
echo "=== ✅ Domínio corrigido com sucesso! ==="
echo "Acesse: https://fisio.furquim.cloud"
echo ""
