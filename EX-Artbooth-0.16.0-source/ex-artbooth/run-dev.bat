@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo EX Artbooth - development run
echo ==================================

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
  echo Open a NEW Command Prompt and run: node -v
  echo If that fails, reinstall Node.js LTS from https://nodejs.org/ with "Add to PATH" enabled.
  pause
  exit /b 1
)

for %%I in ("%NODE_EXE%") do set "NODE_DIR=%%~dpI"
set "PATH=%NODE_DIR%;%APPDATA%\npm;%PATH%"
set "NPM_CMD=%NODE_DIR%npm.cmd"
if not exist "%NPM_CMD%" set "NPM_CMD=npm.cmd"

if not exist node_modules (
  echo Installing dependencies...
  call "%NPM_CMD%" install
  if errorlevel 1 pause & exit /b 1
)

call "%NPM_CMD%" start
