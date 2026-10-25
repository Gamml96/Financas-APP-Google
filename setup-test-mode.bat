@echo off
REM ============================================
REM  Setup - Modo Teste - Financas-APP-Google
REM  Inicia o app em segundo plano e abre o navegador
REM  com o Modo Teste já ativado.
REM ============================================

setlocal

echo ============================================
echo  🔧 Iniciando Modo Teste...
echo ============================================
echo.

REM Verifica se o npm está disponível
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERRO: npm não encontrado no PATH.
    pause
    exit /b 1
)

cd /d "C:\Users\Usuario\Documents\Financas-APP-Google"

REM Inicia o npm run dev em segundo plano (sem janela)
echo 📦 Iniciando servidor de desenvolvimento...
start /min cmd /c "npm run dev > dev-server.log 2>&1"

REM Aguarda o servidor ficar pronto (até 30 segundos)
echo ⏳ Aguardando o servidor inicializar...
set /a counter=0
:wait_loop
timeout /t 2 /n >nul 2>&1
set /a counter+=2
if %counter% geq 30 (
    echo ❌ ERRO: Servidor não inicializou em 30 segundos.
    echo Verifique o dev-server.log para detalhes.
    pause
    exit /b 1
)
REM Verifica se a porta 3000 está respondendo
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 (
    goto wait_loop
)

echo ✅ Servidor iniciado com sucesso!
echo.

REM Abre o navegador com o setup-test-mode.html
echo 🌐 Abrindo navegador com Modo Teste ativado...
start "" "http://localhost:3000/setup-test-mode.html"

echo.
echo ============================================
echo  ✅ Modo Teste está ativo!
echo.
echo  - App: http://localhost:3000
echo  - Para desativar: clique no ícone 🛡️ na navbar
echo  - Para parar: feche este terminal
echo ============================================
echo.

REM Mantém o script aberto
pause