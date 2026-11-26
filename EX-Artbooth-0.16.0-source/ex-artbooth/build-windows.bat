@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo EX Artbooth - Windows build
echo ==================================
echo.

rem This script tries PATH first, then common Node.js install locations.
rem The old script only used "where node", which fails if Node is installed
rem but the Windows PATH was not refreshed or was not configured correctly.

set "NODE_EXE="
for %%I in (node.exe) do (
  if not "%%~$PATH:I"=="" set "NODE_EXE=%%~$PATH:I"
)

if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
set "PF86=%ProgramFiles(x86)%"
if not defined NODE_EXE if defined PF86 if exist "%PF86%\nodejs\node.exe" set "NODE_EXE=%PF86%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_EXE=%LocalAppData%\Programs\nodejs\node.exe"

if not defined NODE_EXE (
  echo Node.js could not be found.
  echo.
  echo If Node.js is already installed, close this window, open a NEW Command Prompt,
  echo and run: node -v
  echo.
  echo If that command fails, reinstall Node.js LTS from https://nodejs.org/
  echo and make sure "Add to PATH" is enabled in the installer.
  echo.
  pause
  exit /b 1
)

for %%I in ("%NODE_EXE%") do set "NODE_DIR=%%~dpI"
set "PATH=%NODE_DIR%;%APPDATA%\npm;%PATH%"
set "NPM_CMD=%NODE_DIR%npm.cmd"
if not exist "%NPM_CMD%" set "NPM_CMD=npm.cmd"

echo Found Node.js:
echo   %NODE_EXE%
"%NODE_EXE%" -v

echo.
echo Checking npm...
call "%NPM_CMD%" -v
if errorlevel 1 (
  echo.
  echo npm could not be found next to Node.js.
  echo Reinstall Node.js LTS from https://nodejs.org/ and include npm.
  pause
  exit /b 1
)

echo.
echo Installing dependencies...
call "%NPM_CMD%" install
if errorlevel 1 (
  echo.
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo Building Windows installer and portable executable...
call "%NPM_CMD%" run build:win
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Done. Check the release folder for the .exe files.
pause
