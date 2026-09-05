@echo off
chcp 65001 >nul
echo ============================================
echo    Campus Flea Market - Starting...
echo ============================================
echo.

echo [1/2] Starting backend (port 3000)...
start "Server-3000" cmd /k "cd /d %~dp0server && npm start"

echo [2/2] Starting frontend (port 5173)...
start "Client-5173" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo ============================================
echo    Done! Visit: http://localhost:5173
echo ============================================
echo.
echo Close the two popup windows to stop services.
pause >nul
