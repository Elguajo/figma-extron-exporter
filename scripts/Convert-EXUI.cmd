@echo off
if "%~1"=="" (
  start "" "%~dp0updater\Extron.LayoutUpdater.exe" --convert
) else (
  start "" "%~dp0updater\Extron.LayoutUpdater.exe" --convert "%~1"
)
