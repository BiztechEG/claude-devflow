@echo off
rem Builds the project board and opens it in the browser. Needs Node.js 18 or later.
setlocal
set "ROOT=%~dp0..\.."
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or later is needed: https://nodejs.org
  pause
  exit /b 1
)
node "%~dp0build-board.mjs"
if errorlevel 1 (
  pause
  exit /b 1
)
start "" "%ROOT%\docs\board\board.html"
endlocal
