@echo off
title LTESISTEM - Configuracion inicial (ADMINISTRADOR)
echo ============================================
echo   LTESISTEM - Setup inicial
echo   (Ejecutar UNA sola vez como Administrador)
echo ============================================
echo.

:: ---- Verificar permisos de administrador ----
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Este script necesita permisos de Administrador.
    echo Haz clic derecho sobre setup.cmd y selecciona
    echo "Ejecutar como administrador"
    echo.
    pause
    exit /b 1
)

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%Backend"
set "FRONTEND_DIR=%ROOT%Frontend"

:: ---- Verificar Node.js ----
echo [1/6] Verificando Node.js...
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Descargalo de https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo    Node.js %%v encontrado

:: ---- Verificar PostgreSQL ----
echo [2/6] Verificando PostgreSQL...
where psql >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] PostgreSQL no esta instalado o no esta en el PATH.
    echo Instalalo con: choco install postgresql16 --params "/Password:admin123 /Port:5432" -y
    pause
    exit /b 1
)
echo    PostgreSQL encontrado

:: ---- Instalar Chocolatey si no existe ----
echo [3/6] Verificando Chocolatey...
where choco >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo    Instalando Chocolatey...
    powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    call refreshenv
) else (
    echo    Chocolatey encontrado
)

:: ---- Instalar mkcert ----
echo [4/6] Instalando mkcert...
where mkcert >nul 2>&1
if %ERRORLEVEL% neq 0 (
    choco install mkcert -y
    call refreshenv
) else (
    echo    mkcert ya esta instalado
)

:: ---- Instalar CA raiz ----
echo [5/6] Instalando certificado raiz (CA)...
mkcert -install
echo    CA instalada en el sistema

:: ---- Instalar dependencias npm ----
echo [6/6] Instalando dependencias del proyecto...
echo    Backend...
cd /d "%BACKEND_DIR%" && npm install
echo    Frontend...
cd /d "%FRONTEND_DIR%" && npm install

:: ---- Prisma ----
echo.
echo Inicializando base de datos...
cd /d "%BACKEND_DIR%" && npx prisma db push
cd /d "%BACKEND_DIR%" && npx prisma generate

echo.
echo ============================================
echo   Setup completado exitosamente!
echo.
echo   Ahora ejecuta start.cmd para arrancar
echo   el proyecto (ya sin necesidad de Admin).
echo ============================================
echo.
pause
