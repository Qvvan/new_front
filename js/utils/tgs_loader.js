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
                containerId: /^auto-renewal-animation-\d+$/,
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
     * 🚀 ИНИЦИАЛИЗАЦИЯ: Ленивая загрузка TGS (не предзагружаем все сразу)
     * ✅ ОПТИМИЗАЦИЯ: Анимации загружаются только при открытии экрана
     */
    async initialize() {
        // ✅ ОПТИМИЗАЦИЯ: Не предзагружаем все анимации - они загрузятся по требованию
        // Это значительно снижает нагрузку при старте приложения
    },

    /**
     * 🎯 Предзагрузка TGS файла в blob URL
     */
    async preloadTGSToBlob(tgsPath) {
        // Проверяем кэш
        if (this.blobCache.has(tgsPath)) {
            return this.blobCache.get(tgsPath);
        }

        // 🚨 Только для TGS файлов
        if (!tgsPath.endsWith('.tgs')) {
            throw new Error(`❌ preloadTGSToBlob работает только с .tgs файлами: ${tgsPath}`);
        }

        try {

            const response = await fetch(tgsPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();

            if (arrayBuffer.byteLength === 0) {
                throw new Error(`❌ Empty TGS file: ${tgsPath}`);
            }

            // Декомпрессия TGS (это gzip архив с JSON)
            const uint8Array = new Uint8Array(arrayBuffer);
            const decompressed = pako.ungzip(uint8Array, { to: 'string' });
            const lottieData = JSON.parse(decompressed);

            // Создаем blob URL
            const blob = new Blob([JSON.stringify(lottieData)], {
                type: 'application/json'
            });
            const blobUrl = URL.createObjectURL(blob);

            const cacheEntry = {
                blobUrl,
                blob,
                lottieData,
                size: blob.size,
                loadTime: Date.now()
            };

            this.blobCache.set(tgsPath, cacheEntry);
            this.lottieDataCache.set(tgsPath, lottieData);

            return cacheEntry;

        } catch (error) {
            throw error; // Пробрасываем ошибку выше
        }
    },

    /**
     * 🎯 ГЛАВНЫЙ МЕТОД: Загрузка TGS анимации с blob URL
     */
    async loadTGSAnimation(containerId, tgsPath, fallbackIcon = 'fas fa-gift') {
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }

        // 🎯 Проверяем тип файла
        if (tgsPath.endsWith('.png') || tgsPath.endsWith('.jpg') || tgsPath.endsWith('.jpeg')) {
            // Это обычное изображение - загружаем как картинку
            await this.loadStaticImage(container, tgsPath, fallbackIcon);
            return;
        }

        if (!tgsPath.endsWith('.tgs')) {
            this.setFallbackIcon(container, fallbackIcon);
            return;
        }

        // Проверяем доступность библиотек для TGS
        if (!this.isLibrariesAvailable()) {
            this.setFallbackIcon(container, fallbackIcon);
            return;
        }

        try {
            let cachedData = this.blobCache.get(tgsPath);

            // Если нет в кэше - загружаем TGS
            if (!cachedData) {
                cachedData = await this.preloadTGSToBlob(tgsPath);
            }

            const { lottieData } = cachedData;

            // Очищаем контейнер
            container.innerHTML = '';

            // Загружаем TGS анимацию
            const animation = lottie.loadAnimation({
                container: container,
                renderer: 'svg',
                loop: true,
                autoplay: !document.hidden,
                animationData: lottieData
            });

            container.lottieAnimation = animation;
            
            if (document.hidden) {
                animation.pause();
            }

        } catch (error) {
            this.setFallbackIcon(container, fallbackIcon);
        }
    },


    /**
     * 🖼️ Загрузка статичных изображений (PNG, JPG)
     */
    async loadStaticImage(container, imagePath, fallbackIcon) {
        try {

            const img = document.createElement('img');
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';

            container.innerHTML = '';
            container.appendChild(img);

            // Всегда используем MediaCache для кеширования PNG изображений
            if (window.MediaCache) {
                await window.MediaCache.setSrc(img, imagePath);
            } else {
                // Fallback - прямая загрузка только если MediaCache недоступен
                img.src = imagePath;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
            }

        } catch (error) {
            this.setFallbackIcon(container, fallbackIcon);
        }
    },

    /**
     * 🎯 ГЛАВНЫЙ МЕТОД: Инициализация анимаций по имени экрана
     */
    async initializeScreen(screenName, customConfig = {}) {
        const preset = this.presets[screenName];
        if (!preset) {
            return;
        }

        const animationsToLoad = [];

        preset.forEach(config => {
            // Обработка условных элементов
            if (config.conditional) {
                const element = document.getElementById(config.containerId);
                if (!element) {
                    return;
                }

                const dataTgsPath = element.getAttribute('data-tgs');
                if (dataTgsPath) {
                    config.tgsPath = dataTgsPath;
                }
            }

            // Обработка динамических элементов (регулярные выражения)
            // ✅ ОПТИМИЗАЦИЯ: querySelectorAll выполняется только при инициализации экрана, не постоянно
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

        } catch (error) {
            
        }
    },


    /**
     * 🧹 Очистка кэша и освобождение памяти
     */
    cleanupCache() {
        // Освобождаем все blob URLs
        this.blobCache.forEach((cache, tgsPath) => {
            URL.revokeObjectURL(cache.blobUrl);
        });

        // Очищаем кэши
        this.blobCache.clear();
        this.lottieDataCache.clear();

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
                    // Игнорируем ошибки очистки
                }
            }
        });

        this.activeAnimations.delete(screenName);
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
        }

        return available;
    }
};

// ✅ ОПТИМИЗАЦИЯ: Убрана автоматическая инициализация - теперь инициализируется только через Assets.preloadAssets()
// Это предотвращает дублирование и позволяет контролировать момент загрузки

// 🧹 Очистка при закрытии страницы
window.addEventListener('beforeunload', () => {
    if (window.TGSLoader) {
        window.TGSLoader.cleanupCache();
    }
});