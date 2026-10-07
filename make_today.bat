@echo off
rem Makes the next day of the posting plan. Add options after the name, for example:
rem   make_today.bat --youtube --instagram --facebook --at 18:00
cd /d "%~dp0"
python tools\daily.py %*
pause
