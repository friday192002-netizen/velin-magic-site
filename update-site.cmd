@echo off
powershell.exe -NoProfile -File "%~dp0tools\update-site.ps1"
if errorlevel 1 pause
