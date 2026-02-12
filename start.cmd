@echo off
title LTESISTEM - Inicio
echo ============================================
echo   LTESISTEM - Iniciando proyecto
echo ============================================
echo.

:: ---- Obtener directorio del script ----
set "ROOT=%~dp0"
set "CERTS_DIR=%ROOT%certs"
set "BACKEND_DIR=%ROOT%Backend"
set "FRONTEND_DIR=%ROOT%Frontend"

:: ---- Verificar que se ejecuto setup.cmd ----
where mkcert >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] mkcert no esta instalado.
    echo Ejecuta setup.cmd como Administrador primero.
    pause
    exit /b 1
)

if not exist "%BACKEND_DIR%\node_modules" (
    echo [ERROR] Dependencias no instaladas.
    echo Ejecuta setup.cmd como Administrador primero.
    pause
    exit /b 1
)

:: ---- Detectar IP local ----
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "RAW_IP=%%a"
)
set "LOCAL_IP=%RAW_IP: =%"
echo [1/4] IP local detectada: %LOCAL_IP%

:: ---- Generar certificados SSL con IP actual ----
echo [2/4] Generando certificados SSL...
if not exist "%CERTS_DIR%" mkdir "%CERTS_DIR%"
mkcert -cert-file "%CERTS_DIR%\cert.pem" -key-file "%CERTS_DIR%\key.pem" localhost 127.0.0.1 %LOCAL_IP% >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] No se pudieron generar los certificados.
    echo Ejecuta setup.cmd como Administrador primero.
    pause
    exit /b 1
)
echo    Certificados OK para %LOCAL_IP%

:: ---- Actualizar .env del Frontend ----
echo [3/4] Configurando URLs...
(
    echo VITE_API_URL=https://%LOCAL_IP%:4000
    echo VITE_SOCKET_URL=https://%LOCAL_IP%:4000
) > "%FRONTEND_DIR%\.env"
echo    API: https://%LOCAL_IP%:4000

:: ---- Arrancar servidores ----
echo [4/4] Arrancando servidores...
echo.
echo ============================================
echo   Backend:  https://%LOCAL_IP%:4000
echo   Frontend: https://%LOCAL_IP%:5173
echo ============================================
echo.
echo   Desde moviles en la misma red WiFi:
echo   https://%LOCAL_IP%:5173
echo.
echo   Cierra esta ventana para detener todo.
echo ============================================
echo.

:: ---- Iniciar Backend en segundo plano ----
start "LTESISTEM-Backend" cmd /c "cd /d "%BACKEND_DIR%" && node src/server.js"

:: ---- Iniciar Frontend (primer plano) ----
cd /d "%FRONTEND_DIR%" && npm run dev
