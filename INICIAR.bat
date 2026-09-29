@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Necesitas instalar Node.js desde https://nodejs.org && pause && exit /b)
if not exist node_modules (
  echo Instalando dependencias por primera vez...
  call npm install
)
node buscar_y_borrar.js
pause
