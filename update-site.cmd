@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   Velin Magic - build the website from content and photos
echo.
python --version >nul 2>&1 || (echo   Python is not installed. Download it from https://www.python.org/downloads/ & goto :error)
python -c "import PIL" >nul 2>&1 || (
  echo   Installing Pillow ^(first time only^)...
  python -m pip install --user Pillow || goto :error
)
python tools\build.py || goto :error
echo.
echo   Preview: http://localhost:4321   ^(close this window to stop^)
start "" http://localhost:4321/
python tools\serve.py 4321
goto :eof

:error
echo.
echo   Something went wrong - read the message above.
pause
