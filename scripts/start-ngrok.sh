#!/bin/bash
# Скрипт для Linux/Mac: запуск ngrok туннеля

echo ""
echo "========================================"
echo "  Запуск ngrok туннеля для Dragon VPN"
echo "========================================"
echo ""

# Проверяем наличие ngrok
if ! command -v ngrok &> /dev/null; then
    echo "[ОШИБКА] Ngrok не найден в PATH"
    echo ""
    echo "Установите ngrok:"
    echo "1. Скачайте: https://ngrok.com/download"
    echo "2. Распакуйте: unzip ngrok.zip"
    echo "3. Добавьте в PATH: sudo mv ngrok /usr/local/bin/"
    echo "4. Настройте: ngrok config add-authtoken YOUR_TOKEN"
    echo ""
    exit 1
fi

# Проверяем, запущен ли локальный сервер
echo "Проверка локального сервера на порту 3000..."
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "[ПРЕДУПРЕЖДЕНИЕ] Локальный сервер не запущен на порту 3000"
    echo ""
    echo "Запустите в другом терминале: npm run dev"
    echo ""
    read -p "Нажмите Enter для продолжения или Ctrl+C для отмены..."
fi

echo ""
echo "Запуск ngrok..."
echo ""
ngrok http 3000

