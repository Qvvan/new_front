class Assets {
    static basePath = 'assets/';

    static getImage(path) {
        return `${this.basePath}images/${path}`;
    }

    static getTGS(name) {
        return this.getImage(`gifs/${name}.tgs`);
    }

    static getStaticGif(name) {
        return this.getImage(`gifs/${name}`);
    }

    static getIcon(name) {
        return this.getImage(`icons/${name}`);
    }

    /**
     * 🔄 Предзагрузка смешанных ассетов
     * ✅ ОПТИМИЗАЦИЯ: Ленивая загрузка - инициализируем TGS Loader, но не предзагружаем все анимации
     */
    static async preloadAssets() {
        // ✅ ОПТИМИЗАЦИЯ: Инициализируем TGS Loader, но НЕ предзагружаем все анимации сразу
        // Анимации будут загружаться по требованию при открытии экранов
        if (window.TGSLoader) {
            // Только проверяем доступность библиотек, но не загружаем все файлы
            if (!window.TGSLoader.isLibrariesAvailable()) {
                Utils.log('warn', 'TGS libraries not available');
            } else {
                Utils.log('info', 'TGS Loader ready for lazy loading');
            }
        }

        // ✅ ОПТИМИЗАЦИЯ: Предзагружаем только критичные изображения
        if (window.MediaCache) {
            const criticalImages = [
                this.getStaticGif('gift-opened.png'),
                // Только самые важные изображения
            ];

            // Загружаем в фоне, не блокируя инициализацию
            Promise.allSettled(
                criticalImages.map(src => window.MediaCache.loadImageSafely(src))
            ).catch(() => {
                // Игнорируем ошибки предзагрузки
            });
        }

        Utils.log('info', 'Assets initialization completed');
    }
}

window.Assets = Assets;