@echo off
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
    echo [1/3] Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo       Done.
) else (
    echo [1/3] Virtual environment found.
)

:: Install/update dependencies
echo [2/3] Installing dependencies...
venv\Scripts\pip.exe install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo       Done.

:: Run the app
echo [3/3] Starting IEMS server...
echo.
echo  ========================================
echo   Open your browser and go to:
echo   http://127.0.0.1:5001
echo.
echo   Default login: admin / admin123
echo   Press Ctrl+C to stop the server.
echo  ========================================
echo.
venv\Scripts\python.exe app.py
pause
