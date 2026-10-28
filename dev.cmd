@echo off
REM Double-click to start the Omega dev server (pulls the latest code first).
cd /d "%~dp0"
taskkill /F /IM node.exe >nul 2>&1
git pull origin expo-app
call npm install --no-audit --no-fund
call npx expo start --dev-client --clear
pause
