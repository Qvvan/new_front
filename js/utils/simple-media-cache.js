/**
 * Простой кэш медиа с blob URLs - как в Telegram
 * Всего 50 строк для максимального эффекта!
 */
window.MediaCache = {
    cache: new Map(),
    loading: new Set(),

    // Загрузка с кэшированием
    async load(url) {
        // Если уже в кэше - возвращаем мгновенно
        if (this.cache.has(url)) {
            return this.cache.get(url);
        }

        // Если уже загружается - ждем
        if (this.loading.has(url)) {
            return this.waitForLoad(url);
        }

        this.loading.add(url);

        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            this.cache.set(url, blobUrl);
            return blobUrl;
        } catch (error) {
            Utils.log('warn', 'Failed to load media:', { url, error });
            return url; // Fallback к оригинальному URL
        } finally {
            this.loading.delete(url);
        }
    },

    // Ожидание загрузки
    waitForLoad(url) {
        return new Promise(resolve => {
            const check = () => {
                if (this.cache.has(url)) {
                    resolve(this.cache.get(url));
                } else if (!this.loading.has(url)) {
                    resolve(url); // Загрузка провалилась
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    },

    // Установка src с кэшем
    async setSrc(element, url) {
        const blobUrl = await this.load(url);
        if (element) element.src = blobUrl;
    },

    // Безопасная загрузка изображения (для предзагрузки)
    async loadImageSafely(url) {
        try {
            return await this.load(url);
        } catch (error) {
            Utils.log('warn', 'Failed to load image safely:', { url, error });
            return url; // Fallback к оригинальному URL
        }
    },

    // Очистка при выгрузке страницы
    cleanup() {
        this.cache.forEach(blobUrl => URL.revokeObjectURL(blobUrl));
        this.cache.clear();
    }
};

// Очистка при выгрузке
window.addEventListener('beforeunload', () => window.MediaCache.cleanup());