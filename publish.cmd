@echo off
REM Double-click to send the latest code to the Omega test app on your iPhone (no rebuild, no dev server).
cd /d "%~dp0"
git pull origin expo-app
call npm install --no-audit --no-fund
call npx eas-cli update --channel preview --platform ios --auto --non-interactive
echo.
echo Done. Close and reopen Omega on your iPhone to load the update.
pause
