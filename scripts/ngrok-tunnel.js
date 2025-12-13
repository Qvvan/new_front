// Скрипт для автоматического запуска ngrok туннеля
const { spawn } = require('child_process');
const http = require('http');

const LOCAL_PORT = process.env.PORT || 3000;
const NGROK_PORT = process.env.NGROK_PORT || 4040;

console.log('🚀 Запуск ngrok туннеля...\n');

// Проверяем доступность локального сервера
function checkServer() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${LOCAL_PORT}`, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      reject(false);
    });

    req.setTimeout(2000, () => {
      req.destroy();
      reject(false);
    });
  });
}

// Запускаем ngrok
async function startNgrok() {
  // Проверяем, запущен ли локальный сервер
  try {
    await checkServer();
    console.log(`✅ Локальный сервер доступен на порту ${LOCAL_PORT}\n`);
  } catch (error) {
    console.error(`❌ Ошибка: Локальный сервер не запущен на порту ${LOCAL_PORT}`);
    console.error(`   Запустите сначала: npm run dev\n`);
    process.exit(1);
  }

  // Запускаем ngrok
  const ngrok = spawn('ngrok', ['http', LOCAL_PORT.toString(), '--log=stdout'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });

  let ngrokUrl = null;

  ngrok.stdout.on('data', (data) => {
    const output = data.toString();
    const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.ngrok(-free)?\.app/g);
    
    if (urlMatch && !ngrokUrl) {
      ngrokUrl = urlMatch[0];
      console.log('\n' + '='.repeat(60));
      console.log('🌐 Ngrok туннель создан!');
      console.log('='.repeat(60));
      console.log(`\n📍 Публичный URL: ${ngrokUrl}`);
      console.log(`\n💡 Используйте этот URL в настройках Telegram Bot:`);
      console.log(`   BotFather -> /setmenubutton -> Ваш бот -> ${ngrokUrl}`);
      console.log('\n' + '='.repeat(60) + '\n');
    }
    
    // Показываем логи ngrok (можно закомментировать для меньшего шума)
    // process.stdout.write(output);
  });

  ngrok.stderr.on('data', (data) => {
    const error = data.toString();
    if (error.includes('command not found') || error.includes('не является')) {
      console.error('\n❌ Ошибка: ngrok не найден в системе');
      console.error('   Установите ngrok: https://ngrok.com/download\n');
      process.exit(1);
    }
    process.stderr.write(error);
  });

  ngrok.on('close', (code) => {
    if (code !== 0) {
      console.error(`\n❌ Ngrok завершился с кодом ${code}`);
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Остановка ngrok туннеля...');
    ngrok.kill();
    process.exit(0);
  });

  // Показываем веб-интерфейс ngrok
  console.log(`\n📊 Ngrok веб-интерфейс: http://localhost:${NGROK_PORT}`);
  console.log('   (для просмотра статистики и логов)\n');
}

startNgrok().catch((error) => {
  console.error('Ошибка при запуске ngrok:', error);
  process.exit(1);
});

