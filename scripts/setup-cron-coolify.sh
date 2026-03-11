#!/bin/bash
# Script para configurar cron job no container Coolify
# Execute este script DENTRO do container Docker

# Criar script de notificação
cat > /app/notify-shifts.sh << 'EOF'
#!/bin/bash
curl -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/notify-shifts
EOF

chmod +x /app/notify-shifts.sh

# Adicionar ao crontab
(crontab -l 2>/dev/null; echo "0 18 * * * /app/notify-shifts.sh >> /var/log/notify-shifts.log 2>&1") | crontab -

echo "✅ Cron job configurado com sucesso!"
echo "Logs serão salvos em: /var/log/notify-shifts.log"
