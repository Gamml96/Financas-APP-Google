# Setup - Modo Teste - Financas-APP-Google
# Inicia o app em segundo plano e abre o navegador com o Modo Teste já ativado.

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  🔧 Iniciando Modo Teste..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$projectPath = "C:\Users\Usuario\Documents\Financas-APP-Google"

# Verifica se o npm está disponível
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERRO: npm não encontrado no PATH." -ForegroundColor Red
    pause
    exit 1
}

Set-Location $projectPath

# Inicia o npm run dev em segundo plano
Write-Host "📦 Iniciando servidor de desenvolvimento..." -ForegroundColor Yellow
$devJob = Start-Job -ScriptBlock {
    Set-Location $using:projectPath
    npm run dev 2>&1 | Out-File -FilePath "$using:projectPath\dev-server.log" -Append
}

# Aguarda o servidor ficar pronto
Write-Host "⏳ Aguardando o servidor inicializar..." -ForegroundColor Yellow
$counter = 0
$serverReady = $false
while ($counter -lt 30) {
    Start-Sleep -Seconds 2
    $counter += 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
            break
        }
    } catch {
        # Servidor ainda não está pronto
    }
}

if (-not $serverReady) {
    Write-Host "❌ ERRO: Servidor não inicializou em 30 segundos." -ForegroundColor Red
    Write-Host "Verifique o dev-server.log para detalhes." -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✅ Servidor iniciado com sucesso!" -ForegroundColor Green
Write-Host ""

# Abre o navegador com o setup-test-mode.html
Write-Host "🌐 Abrindo navegador com Modo Teste ativado..." -ForegroundColor Yellow
Start-Process "http://localhost:3000/setup-test-mode.html"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ✅ Modo Teste está ativo!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  - App: http://localhost:3000" -ForegroundColor White
Write-Host "  - Para desativar: clique no ícone 🛡️ na navbar" -ForegroundColor White
Write-Host "  - Para parar: feche este terminal" -ForegroundColor White
Write-Host ""

# Mantém o script aberto
pause