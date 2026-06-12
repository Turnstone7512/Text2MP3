@echo off
setlocal

cd /d "%~dp0"

echo.
echo === Text2MP3 GitHub Upload ===
echo Repository folder: %cd%
echo.

git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed or not available in PATH.
    echo Please install Git for Windows first.
    pause
    exit /b 1
)

echo Marking this folder as a safe Git directory...
git config --global --add safe.directory "%cd%"
if errorlevel 1 goto :error

if not exist ".git" (
    echo Git repository not found. Initializing repository...
    git init -b main
    if errorlevel 1 goto :error
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adding GitHub remote origin...
    git remote add origin https://github.com/Turnstone7512/Text2MP3.git
    if errorlevel 1 goto :error
) else (
    echo Remote origin:
    git remote get-url origin
)

echo.
echo Current changes:
git status --short
echo.

set "COMMIT_MESSAGE=Update Text2MP3 static web app"
if not "%~1"=="" set "COMMIT_MESSAGE=%~1"

echo Adding files...
git add .
if errorlevel 1 goto :error

git diff --cached --quiet
if errorlevel 1 (
    echo Creating commit: %COMMIT_MESSAGE%
    git commit -m "%COMMIT_MESSAGE%"
    if errorlevel 1 goto :error
) else (
    echo No file changes to commit.
)

echo.
echo Pushing to GitHub...
git push -u origin main
if errorlevel 1 goto :error

echo.
echo Upload completed successfully.
echo GitHub repository: https://github.com/Turnstone7512/Text2MP3
pause
exit /b 0

:error
echo.
echo Upload failed. Please check the error message above.
echo If GitHub asks you to sign in, complete authentication and run this file again.
pause
exit /b 1
