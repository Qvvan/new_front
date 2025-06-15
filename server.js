// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const server = http.createServer((req, res) => {
  console.log(`📥 Запрос: ${req.url}`);

  // Парсим URL и параметры
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const queryParams = parsedUrl.query;

  // Логируем важные параметры для Telegram WebApp
  if (queryParams.tgWebAppStartParam) {
    console.log(`🔗 Получен параметр startapp: ${queryParams.tgWebAppStartParam}`);
  }
  if (queryParams.start) {
    console.log(`🎯 Получен параметр start: ${queryParams.start}`);
  }

  // Обработка статических файлов
  const fileMap = {
    // HTML
    '/': 'index.html',
    '/index.html': 'index.html',

    // CSS
    '/css/globals.css': 'css/globals.css',
    '/css/components.css': 'css/components.css',
    '/css/layouts.css': 'css/layouts.css',
    '/css/animations.css': 'css/animations.css',
    '/css/responsive.css': 'css/responsive.css',
    '/css/simple-media.css': 'css/simple-media.css',

    // Core JS
    '/js/core/utils.js': 'js/core/utils.js',
    '/js/core/storage.js': 'js/core/storage.js',
    '/js/core/telegram.js': 'js/core/telegram.js',
    '/js/core/router.js': 'js/core/router.js',
    '/js/core/app.js': 'js/core/app.js',

    // API JS
    '/js/api/client.js': 'js/api/client.js',
    '/js/api/user.js': 'js/api/user.js',
    '/js/api/subscription.js': 'js/api/subscription.js',
    '/js/api/payment.js': 'js/api/payment.js',
    '/js/api/keys.js': 'js/api/keys.js',
    '/js/api/referral.js': 'js/api/referral.js',
    '/js/api/services.js': 'js/api/services.js',

    // Components JS
    '/js/components/toast.js': 'js/components/toast.js',
    '/js/components/modal.js': 'js/components/modal.js',
    '/js/components/loading.js': 'js/components/loading.js',
    '/js/components/navigation.js': 'js/components/navigation.js',
    '/js/components/subscription-card.js': 'js/components/subscription-card.js',
    '/js/components/service-selector.js': 'js/components/service-selector.js',
    '/js/components/payment-banner.js': 'js/components/payment-banner.js',

    // Services JS
    '/js/services/haptic.js': 'js/services/haptic.js',
    '/js/services/payment-monitor.js': 'js/services/payment-monitor.js',
    '/js/services/referral-parser.js': 'js/services/referral-parser.js',
    '/js/services/subscription-manager.js': 'js/services/subscription-manager.js',

    // Screens JS
    '/js/screens/subscription.js': 'js/screens/subscription.js',
    '/js/screens/keys.js': 'js/screens/keys.js',
    '/js/screens/referrals.js': 'js/screens/referrals.js',
    '/js/screens/payments.js': 'js/screens/payments.js',
    '/js/screens/instructions.js': 'js/screens/instructions.js',
    '/js/screens/support.js': 'js/screens/support.js',

    // Utils
    '/js/utils/assets.js': 'js/utils/assets.js',
    '/js/utils/simple-media-cache.js': 'js/utils/simple-media-cache.js',
    '/js/utils/simple-lazy.js': 'js/utils/simple-lazy.js',
    '/js/utils/tgs-loader.js': 'js/utils/tgs-loader.js',

    // Assets
    '/assets/images/gifs/gift-animate.gif': 'assets/images/gifs/gift-animate.gif',
    '/assets/images/gifs/gift-opened.png': 'assets/images/gifs/gift-opened.png',
    '/assets/images/gifs/auto-renewal.gif': 'assets/images/gifs/auto-renewal.gif',
    '/assets/images/gifs/management.gif': 'assets/images/gifs/management.gif',

    // Misc
    '/favicon.ico': 'favicon.ico'
  };

  // Для главной страницы (с параметрами или без) отдаем index.html
  let filePath = pathname === '/' ? 'index.html' : fileMap[pathname];

  // Если файл не найден в карте, пробуем найти его по пути
  if (!filePath && pathname !== '/') {
    const potentialPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    if (fs.existsSync(path.join(__dirname, potentialPath))) {
      filePath = potentialPath;
    }
  }

  if (filePath) {
    serveFile(res, filePath, getContentType(filePath));
  } else {
    console.log(`❌ Файл не найден: ${pathname}`);
    res.writeHead(404, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>404 - Not Found</title></head>
      <body style="font-family: Arial; padding: 20px; background: #0d0d0d; color: white;">
        <h1>404 - Файл не найден</h1>
        <p>Запрошенный файл <code>${pathname}</code> не существует.</p>
        <a href="/" style="color: #fff;">← Вернуться на главную</a>
      </body>
      </html>
    `);
  }
});

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8'
  };

  return contentTypes[ext] || 'application/octet-stream';
}

function serveFile(res, filename, contentType) {
  const filePath = path.join(__dirname, filename);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      console.log(`❌ Ошибка чтения файла ${filename}:`, err.message);
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
      return;
    }

    console.log(`✅ Отдан файл: ${filename} (${content.length} bytes)`);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*', // Для разработки
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(content);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Остановка сервера...');
  server.close(() => {
    console.log('✅ Сервер остановлен');
    process.exit(0);
  });
});

server.listen(8080, () => {
  console.log('🚀 Dragon VPN Dev Server запущен на http://localhost:8080');
  console.log('📁 Структура файлов готова к разработке');
  console.log('🔄 Кеширование отключено для разработки');
  console.log('\nДля остановки нажмите Ctrl+C');
});