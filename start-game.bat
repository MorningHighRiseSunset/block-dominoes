@echo off
cd /d "%~dp0"
echo.
echo  Block Dominoes - starting dev server...
echo  Close Live Server if it is using port 5173 or 5500.
echo.
call npm run dev
pause
