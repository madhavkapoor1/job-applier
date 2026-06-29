@echo off
REM Job Applier - Windows launcher. Double-click to start the app.
cd /d "%~dp0"
title Job Applier

echo ===============================================
echo    Job Applier - starting up
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Please install the "LTS" version from https://nodejs.org , then run this again.
  echo.
  pause
  exit /b 1
)

if not exist .env if exist .env.example copy .env.example .env >nul

if not exist node_modules (
  echo Installing the app ^(first time only - a few minutes^)...
  call npm install
  if errorlevel 1 ( echo Install failed - see messages above. & pause & exit /b 1 )
  echo Setting up the application browser...
  call npx playwright install chromium
  echo.
)

if not exist .next (
  echo Preparing the app ^(first time only^)...
  call npm run build
  if errorlevel 1 ( echo Build failed - see messages above. & pause & exit /b 1 )
  echo.
)

echo Starting Job Applier... a browser tab will open shortly.
echo To STOP it: close this window.
echo.
start "" "http://localhost:3000"
call npm run start -- -p 3000
pause
