@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap.ps1" -Mode Run
if errorlevel 1 (
  echo.
  echo The game could not start. Read the error above, then try again.
  pause
  exit /b 1
)
