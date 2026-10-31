@echo off
rem Notloesung, falls das Startprogramm blockiert wird. Projekte werden dann nur im Browser gespeichert.
set "P=%~dp0app\index.html"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="file:///%P%") else (start "" "%P%")
