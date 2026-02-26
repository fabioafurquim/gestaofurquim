# Script para fazer backup do banco de dados local
# Execute este script no PowerShell

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "backup_plantaofisio_$timestamp.sql"

Write-Host "=== Backup do Banco de Dados Local ===" -ForegroundColor Green
Write-Host ""

# Tentar encontrar pg_dump
$pgDumpPaths = @(
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe",
    "C:\Program Files (x86)\PostgreSQL\16\bin\pg_dump.exe",
    "C:\Program Files (x86)\PostgreSQL\15\bin\pg_dump.exe"
)

$pgDump = $null
foreach ($path in $pgDumpPaths) {
    if (Test-Path $path) {
        $pgDump = $path
        break
    }
}

if (-not $pgDump) {
    # Tentar encontrar no PATH
    $pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
}

if (-not $pgDump) {
    Write-Host "❌ pg_dump não encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Opções:" -ForegroundColor Yellow
    Write-Host "1. Instale PostgreSQL: https://www.postgresql.org/download/windows/" -ForegroundColor Cyan
    Write-Host "2. Ou use o método alternativo abaixo:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "=== Método Alternativo (Prisma) ===" -ForegroundColor Yellow
    Write-Host "Execute estes comandos:" -ForegroundColor Cyan
    Write-Host "  npx prisma db pull" -ForegroundColor White
    Write-Host "  npx prisma db push --force-reset" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Usando: $pgDump" -ForegroundColor Cyan
Write-Host "Criando backup em: $backupFile" -ForegroundColor Yellow
Write-Host ""

# Fazer dump do banco de dados
$env:PGPASSWORD = "Fmm20615"
& $pgDump -h localhost -p 5432 -U postgres -d plantaofisio -F p -f $backupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Backup criado com sucesso!" -ForegroundColor Green
    Write-Host "Arquivo: $backupFile" -ForegroundColor Cyan
    Write-Host "Tamanho: $((Get-Item $backupFile).Length / 1KB) KB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Próximo passo: Execute o script restore-database.ps1" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ Erro ao criar backup!" -ForegroundColor Red
    Write-Host "Verifique se o PostgreSQL está instalado e rodando" -ForegroundColor Red
}

Remove-Item Env:\PGPASSWORD
