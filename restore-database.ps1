# Script para restaurar backup do banco de dados em produção
# Execute este script no PowerShell

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile
)

Write-Host "=== Restore do Banco de Dados em Produção ===" -ForegroundColor Green
Write-Host ""

# Se não foi passado arquivo, listar backups disponíveis
if (-not $BackupFile) {
    $backups = Get-ChildItem -Filter "backup_plantaofisio_*.sql" | Sort-Object LastWriteTime -Descending
    
    if ($backups.Count -eq 0) {
        Write-Host "❌ Nenhum arquivo de backup encontrado!" -ForegroundColor Red
        Write-Host "Execute primeiro: .\backup-database.ps1" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "Backups disponíveis:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $backups.Count; $i++) {
        $backup = $backups[$i]
        Write-Host "[$i] $($backup.Name) - $($backup.LastWriteTime) - $([math]::Round($backup.Length / 1KB, 2)) KB"
    }
    
    Write-Host ""
    $selection = Read-Host "Escolha o número do backup (0 para o mais recente)"
    $BackupFile = $backups[$selection].Name
}

if (-not (Test-Path $BackupFile)) {
    Write-Host "❌ Arquivo não encontrado: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Arquivo selecionado: $BackupFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  ATENÇÃO: Isso vai SUBSTITUIR todos os dados em produção!" -ForegroundColor Red
Write-Host "Tem certeza que deseja continuar? (S/N)" -ForegroundColor Yellow
$confirm = Read-Host

if ($confirm -ne "S" -and $confirm -ne "s") {
    Write-Host "Operação cancelada." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Transferindo backup para o servidor..." -ForegroundColor Yellow

# Transferir arquivo para o servidor
scp $BackupFile root@187.77.57.122:/tmp/restore.sql

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao transferir arquivo!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Arquivo transferido com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "Restaurando banco de dados em produção..." -ForegroundColor Yellow

# Executar restore no servidor
$restoreScript = @"
#!/bin/bash
echo '=== Restaurando banco de dados ==='

# Container do PostgreSQL em produção
DB_CONTAINER='jk4ss8ssocc4owows0csw4kg'
DB_NAME='plantaofisio'
DB_USER='postgres'

# Copiar arquivo para dentro do container
docker cp /tmp/restore.sql `$DB_CONTAINER:/tmp/restore.sql

# Limpar banco atual (cuidado!)
echo 'Limpando banco atual...'
docker exec `$DB_CONTAINER psql -U `$DB_USER -d `$DB_NAME -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

# Restaurar backup
echo 'Restaurando backup...'
docker exec `$DB_CONTAINER psql -U `$DB_USER -d `$DB_NAME -f /tmp/restore.sql

# Limpar arquivo temporário
docker exec `$DB_CONTAINER rm /tmp/restore.sql
rm /tmp/restore.sql

echo ''
echo '✅ Restore concluído com sucesso!'
"@

# Salvar script temporário
$restoreScript | Out-File -FilePath "restore-temp.sh" -Encoding ASCII

# Transferir e executar script
scp restore-temp.sh root@187.77.57.122:/tmp/restore-temp.sh
ssh root@187.77.57.122 "bash /tmp/restore-temp.sh"

# Limpar arquivo temporário local
Remove-Item restore-temp.sh

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Banco de dados restaurado com sucesso em produção!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Teste agora: https://fisio.furquim.cloud" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Erro ao restaurar banco de dados!" -ForegroundColor Red
}
