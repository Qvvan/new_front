// TGS Animation Loader with Blob URL Caching for Dragon VPN Mini App

window.TGSLoader = {
    /**
     * Кэш blob URLs для предотвращения повторных загрузок
     */
    blobCache: new Map(),

    /**
     * Кэш обработанных Lottie данных
     */
    lottieDataCache: new Map(),

    /**
     * Активные анимации по экранам (для cleanup)
     */
    activeAnimations: new Map(),

    /**
     * Предустановленные конфигурации анимаций для разных экранов
     */
    presets: {
        subscription: [
            {
                containerId: 'tgs-animation-container',
                tgsPath: 'assets/images/gifs/empty-profiles.tgs',
                fallbackIcon: 'fas fa-ghost',
                preload: true
            },
            {
                containerId: 'trial-gift-tgs',
                tgsPath: 'assets/images/gifs/gift-animate.tgs',
                fallbackIcon: 'fas fa-gift',
                conditional: true,
                preload: true
            },
            {
                containerId: 'trial-used-tgs',
                tgsPath: 'assets/images/gifs/gift-opened.png',
                fallbackIcon: 'fas fa-gift-card',
                conditional: true,
                preload: true
            },
            {
                containerId: 'management-animation',
                tgsPath: 'assets/images/gifs/management.tgs',
                fallbackIcon: 'fas fa-cog',
                preload: true
            },
            {
                containerId: 'buy-subscription',
                tgsPath: 'assets/images/gifs/buy-subscription.tgs',
                fallbackIcon: 'fas fa-cog',
                preload: true
            },
            {
                containerId: /^auto-renewal-animation-.+$/,
                tgsPath: 'assets/images/gifs/auto-renewal.tgs',
                fallbackIcon: 'fas fa-sync-alt',
                dynamic: true,
                preload: true
            }
        ],

        referrals: [
            {
                containerId: 'referral-main-animation',
                tgsPath: 'assets/images/gifs/referral-invite.tgs',
                fallbackIcon: 'fas fa-users',
                preload: true
            },
            {
                containerId: 'referrals-empty-animation',
                tgsPath: 'assets/images/gifs/empty-referrals.tgs',
                fallbackIcon: 'fas fa-user-plus',
                preload: true
            },
            {
                containerId: 'telegram-share-animation',
                tgsPath: 'assets/images/gifs/telegram-share.tgs',
                fallbackIcon: 'fab fa-telegram-plane',
                preload: true
            },
            {
                containerId: 'story-share-animation',
                tgsPath: 'assets/images/gifs/story-share.tgs',
                fallbackIcon: 'fas fa-camera',
                preload: true
            },
            {
                containerId: 'multiple-share-animation',
                tgsPath: 'assets/images/gifs/multiple-share.tgs',
                fallbackIcon: 'fas fa-share-alt',
                preload: true
            }
        ],

        keys: [
            {
                containerId: 'vpn-access-animation',
                tgsPath: 'assets/images/gifs/vpn-access.tgs',
                fallbackIcon: 'fas fa-shield-alt',
                preload: true
            },
            {
                containerId: 'profile-tab-animation',
                tgsPath: 'assets/images/gifs/profile-tab.tgs',
                fallbackIcon: 'fas fa-user-cog',
                preload: true
            },
            {
                containerId: 'keys-tab-animation',
                tgsPath: 'assets/images/gifs/keys-tab.tgs',
                fallbackIcon: 'fas fa-key',
                preload: true
            },
            {
                containerId: 'keys-empty-animation',
                tgsPath: 'assets/images/gifs/empty-profiles.tgs',
                fallbackIcon: 'fas fa-key',
                preload: true
            }
        ],

        payments: [
            {
                containerId: 'payments-empty-animation',
                tgsPath: 'assets/images/gifs/empty-profiles.tgs',
                fallbackIcon: 'fas fa-receipt'
            },
            {
                containerId: 'payment-success-animation',
                tgsPath: 'assets/images/gifs/payment-success.tgs',
                fallbackIcon: 'fas fa-check-circle'
            }
        ]
    },


    /**
     * 🚀 ИНИЦИАЛИЗАЦИЯ: Предзагрузка критичных TGS в blob URLs
     */
    async initialize() {
        Utils.log('info', '🚀 Initializing TGS Loader with blob caching...');

        // Собираем все файлы для предзагрузки
        const preloadFiles = new Set();

        Object.values(this.presets).forEach(preset => {
            preset.forEach(config => {
                if (config.preload) {
                    preloadFiles.add(config.tgsPath);
                }
            });
        });

        // Предзагружаем в фоне
        const preloadPromises = Array.from(preloadFiles).map(tgsPath =>
            this.preloadTGSToBlob(tgsPath)
        );

        try {
            await Promise.allSettled(preloadPromises);
            Utils.log('info', `✅ Preloaded ${preloadFiles.size} TGS files as blob URLs`);
        } catch (error) {
            Utils.log('error', 'Failed to preload some TGS files:', error);
        }
    },

    /**
     * 🎯 Предзагрузка TGS файла в blob URL
     */
    async preloadTGSToBlob(tgsPath) {
        // Проверяем кэш
        if (this.blobCache.has(tgsPath)) {
            Utils.log('debug', `TGS already cached: ${tgsPath}`);
            return this.blobCache.get(tgsPath);
        }

        try {
            Utils.log('debug', `📥 Preloading TGS: ${tgsPath}`);

            // HTTP запрос за TGS файлом
            const response = await fetch(tgsPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();

            // Декомпрессия TGS
            const uint8Array = new Uint8Array(arrayBuffer);
            const decompressed = pako.ungzip(uint8Array, { to: 'string' });
            const lottieData = JSON.parse(decompressed);

            // Создаем blob URL из Lottie JSON
            const blob = new Blob([JSON.stringify(lottieData)], {
                type: 'application/json'
            });
            const blobUrl = URL.createObjectURL(blob);

            // Кэшируем и blob URL и Lottie данные
            this.blobCache.set(tgsPath, {
                blobUrl,
                blob,
                lottieData,
                size: blob.size,
                loadTime: Date.now()
            });

            this.lottieDataCache.set(tgsPath, lottieData);

            Utils.log('debug', `✅ Cached blob URL for ${tgsPath}: ${blobUrl} (${blob.size} bytes)`);
            return this.blobCache.get(tgsPath);

        } catch (error) {
            Utils.log('error', `❌ Failed to preload ${tgsPath}:`, error);
            throw error;
        }
    },

    /**
     * 🎯 ГЛАВНЫЙ МЕТОД: Загрузка TGS анимации с blob URL
     */
    async loadTGSAnimation(containerId, tgsPath, fallbackIcon = 'fas fa-gift') {
        const container = document.getElementById(containerId);
        if (!container) {
            Utils.log('warn', `TGS Container not found: ${containerId}`);
            return;
        }

        // Проверяем доступность библиотек
        if (!this.isLibrariesAvailable()) {
            this.setFallbackIcon(container, fallbackIcon);
            return;
        }

        try {
            let cachedData = this.blobCache.get(tgsPath);

            // Если нет в кэше - загружаем и создаем blob URL
            if (!cachedData) {
                Utils.log('debug', `Loading TGS on demand: ${tgsPath}`);
                cachedData = await this.preloadTGSToBlob(tgsPath);
            }

            // Используем кэшированные Lottie данные (мгновенно!)
            const { lottieData } = cachedData;

            // Очищаем контейнер
            container.innerHTML = '';

            // Загружаем анимацию напрямую из данных (без сетевых запросов)
            const animation = lottie.loadAnimation({
                container: container,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                animationData: lottieData // ← Используем кэшированные данные
            });

            // Сохраняем ссылку для cleanup
            container.lottieAnimation = animation;

            Utils.log('debug', `✅ TGS animation loaded from cache: ${containerId}`);

        } catch (error) {
            Utils.log('error', `Failed to load TGS ${tgsPath}:`, error);
            this.setFallbackIcon(container, fallbackIcon);
        }
    },

    /**
     * 🎯 ГЛАВНЫЙ МЕТОД: Инициализация анимаций по имени экрана
     */
    async initializeScreen(screenName, customConfig = {}) {
        Utils.log('info', `🎬 Initializing TGS animations for screen: ${screenName}`);

        const preset = this.presets[screenName];
        if (!preset) {
            Utils.log('warn', `No TGS preset found for screen: ${screenName}`);
            return;
        }

        const animationsToLoad = [];

        preset.forEach(config => {
            // Обработка условных элементов
            if (config.conditional) {
                const element = document.getElementById(config.containerId);
                if (!element) {
                    Utils.log('debug', `Conditional TGS element not found: ${config.containerId}`);
                    return;
                }

                const dataTgsPath = element.getAttribute('data-tgs');
                if (dataTgsPath) {
                    config.tgsPath = dataTgsPath;
                }
            }

            // Обработка динамических элементов (регулярные выражения)
            if (config.dynamic && config.containerId instanceof RegExp) {
                const allElements = document.querySelectorAll('[id]');
                allElements.forEach(element => {
                    if (config.containerId.test(element.id)) {
                        animationsToLoad.push({
                            containerId: element.id,
                            tgsPath: config.tgsPath,
                            fallbackIcon: config.fallbackIcon
                        });
                    }
                });
            } else {
                animationsToLoad.push(config);
            }
        });

        // Добавляем кастомные анимации
        if (customConfig.animations) {
            animationsToLoad.push(...customConfig.animations);
        }

        // 🚀 Загружаем все анимации (из кэша = мгновенно!)
        const promises = animationsToLoad.map(({ containerId, tgsPath, fallbackIcon }) =>
            this.loadTGSAnimation(containerId, tgsPath, fallbackIcon)
        );

        try {
            await Promise.allSettled(promises);

            // Сохраняем для cleanup
            this.activeAnimations.set(screenName, animationsToLoad.map(a => a.containerId));

            Utils.log('info', `✅ Initialized ${animationsToLoad.length} TGS animations for ${screenName}`);
        } catch (error) {
            Utils.log('error', `Failed to initialize TGS animations for ${screenName}:`, error);
        }
    },

    /**
     * 📊 Получение статистики кэша
     */
    getCacheStats() {
        const totalSize = Array.from(this.blobCache.values())
            .reduce((sum, cache) => sum + cache.size, 0);

        return {
            cachedFiles: this.blobCache.size,
            totalSizeKB: Math.round(totalSize / 1024),
            blobUrls: Array.from(this.blobCache.values()).map(cache => cache.blobUrl)
        };
    },

    /**
     * 🧹 Очистка кэша и освобождение памяти
     */
    cleanupCache() {
        // Освобождаем все blob URLs
        this.blobCache.forEach((cache, tgsPath) => {
            URL.revokeObjectURL(cache.blobUrl);
            Utils.log('debug', `🧹 Revoked blob URL for: ${tgsPath}`);
        });

        // Очищаем кэши
        this.blobCache.clear();
        this.lottieDataCache.clear();

        Utils.log('info', '🧹 TGS cache cleared');
    },

    /**
     * 🧹 Очистка анимаций для конкретного экрана
     */
    cleanupScreen(screenName) {
        const containerIds = this.activeAnimations.get(screenName);
        if (!containerIds) return;

        containerIds.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container && container.lottieAnimation) {
                try {
                    container.lottieAnimation.destroy();
                    delete container.lottieAnimation;
                } catch (error) {
                    Utils.log('warn', `Failed to cleanup animation ${containerId}:`, error);
                }
            }
        });

        this.activeAnimations.delete(screenName);
        Utils.log('info', `🧹 Cleaned up TGS animations for screen: ${screenName}`);
    },

    /**
     * 🧹 Очистка всех анимаций
     */
    cleanupAll() {
        this.activeAnimations.forEach((containerIds, screenName) => {
            this.cleanupScreen(screenName);
        });
    },

    /**
     * Установка fallback иконки
     */
    setFallbackIcon(container, iconClass) {
        const size = Math.min(container.offsetWidth, container.offsetHeight) || 48;
        container.innerHTML = `<i class="${iconClass}" style="font-size: ${size}px; color: var(--accent-white);"></i>`;
    },

    /**
     * Проверка доступности библиотек
     */
    isLibrariesAvailable() {
        const available = typeof lottie !== 'undefined' && typeof pako !== 'undefined';

        if (!available) {
            Utils.log('error', 'Required libraries not loaded (lottie/pako)');
        }

        return available;
    }
};

// 🚀 Автоматическая инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    // Ждем загрузки библиотек
    const maxWait = 5000; // 5 секунд максимум
    const startTime = Date.now();

    while (!window.TGSLoader.isLibrariesAvailable() && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (window.TGSLoader.isLibrariesAvailable()) {
        await window.TGSLoader.initialize();
        Utils.log('info', '🎉 TGS Loader initialized with blob caching');

        // Выводим статистику
        const stats = window.TGSLoader.getCacheStats();
        Utils.log('info', `📊 TGS Cache: ${stats.cachedFiles} files, ${stats.totalSizeKB}KB`);
    } else {
        Utils.log('error', '❌ Failed to initialize TGS Loader - libraries not available');
    }
});

// 🧹 Очистка при закрытии страницы
window.addEventListener('beforeunload', () => {
    if (window.TGSLoader) {
        window.TGSLoader.cleanupCache();
    }
});