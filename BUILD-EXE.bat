@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap.ps1" -Mode Build
if errorlevel 1 (
  echo.
  echo The build failed. Read the error above, then try again.
  pause
  exit /b 1
)
echo.
echo Build complete. Your standalone EXE is in the release folder.
pause
