@echo off
cd /d "%~dp0"
title IEMS - ICT Equipment Inventory Management System
echo.
echo  ========================================
echo   IEMS - Starting Up...
echo  ========================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.11+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

:: Create virtual environment if it doesn't exist
if not exist "venv\Scripts\python.exe" (
    echo [1/4] Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo       Done.
) else (
    echo [1/4] Virtual environment found.
)

:: Install/update dependencies
echo [2/4] Installing dependencies...
venv\Scripts\pip.exe install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo       Done.

:: Allow port 5001 through Windows Firewall (runs silently, requires admin)
echo [3/4] Configuring firewall rule for port 5001...
netsh advfirewall firewall show rule name="IEMS Port 5001" >nul 2>&1
if errorlevel 1 (
    netsh advfirewall firewall add rule name="IEMS Port 5001" dir=in action=allow protocol=TCP localport=5001 >nul 2>&1
    if errorlevel 1 (
        echo       [WARN] Could not add firewall rule automatically.
        echo       Run this script as Administrator, or manually allow port 5001
        echo       in Windows Defender Firewall to enable network access.
    ) else (
        echo       Firewall rule added successfully.
    )
) else (
    echo       Firewall rule already exists.
)

:: Detect local network IP (prefer real LAN, skip VM adapters)
echo [4/4] Detecting network IP...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*10\." 2^>nul') do (
    if not defined LOCAL_IP set LOCAL_IP=%%a
)
if not defined LOCAL_IP (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*192\.168\.[0-2][0-4][0-9]\." 2^>nul') do (
        if not defined LOCAL_IP set LOCAL_IP=%%a
    )
)
if not defined LOCAL_IP (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*172\." 2^>nul') do (
        if not defined LOCAL_IP set LOCAL_IP=%%a
    )
)
:: Trim leading space
if defined LOCAL_IP set LOCAL_IP=%LOCAL_IP:~1%

:: Run the app
echo.
echo  ========================================
echo   IEMS Server is RUNNING
echo.
echo   YOUR machine  : http://127.0.0.1:5001
if defined LOCAL_IP (
echo   NETWORK access: http://%LOCAL_IP%:5001
echo.
echo   Share the NETWORK link with your boss!
) else (
echo   [Could not detect LAN IP - run ipconfig to find it]
)
echo.
echo   Default login : admin / admin123
echo   Press Ctrl+C to stop the server.
echo  ========================================
echo.
venv\Scripts\python.exe app.py
pause
