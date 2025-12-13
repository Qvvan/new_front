@echo off
REM Скрипт для Windows: запуск ngrok туннеля
echo.
echo ========================================
echo   Запуск ngrok туннеля для Dragon VPN
echo ========================================
echo.

REM Проверяем наличие ngrok
where ngrok >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ОШИБКА] Ngrok не найден в PATH
    echo.
    echo Установите ngrok:
    echo 1. Скачайте: https://ngrok.com/download
    echo 2. Распакуйте в папку
    echo 3. Добавьте в PATH или поместите ngrok.exe в эту папку
    echo.
    pause
    exit /b 1
)

REM Проверяем, запущен ли локальный сервер
echo Проверка локального сервера на порту 3000...
curl -s http://localhost:3000 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ПРЕДУПРЕЖДЕНИЕ] Локальный сервер не запущен на порту 3000
    echo.
    echo Запустите в другом терминале: npm run dev
    echo.
    pause
)

echo.
echo Запуск ngrok...
echo.
ngrok http 3000

pause

