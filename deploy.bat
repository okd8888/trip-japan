@echo off
rem ASCII only -- all messages live in deploy.ps1.
rem A .bat containing UTF-8 Chinese breaks cmd.exe's parser (chcp 65001 byte-seek bug).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
if errorlevel 1 pause
