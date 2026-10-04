@echo off
REM LifeOS Spencer gateway — use FORWARD slashes in HERMES_HOME
set HERMES_HOME=C:/dev/LifeOS1/hermes
set API_SERVER_ENABLED=true
set API_SERVER_KEY=lifeos-local-dev
set API_SERVER_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://lifeos1.pages.dev
hermes gateway run