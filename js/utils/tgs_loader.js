// TGS Animation Loader Utility for Dragon VPN Mini App

// Проверяем загрузку необходимых библиотек
if (typeof lottie === 'undefined' || typeof pako === 'undefined') {
    Utils.log('error', 'Required libraries not loaded. Waiting for them...');
    window.addEventListener('load', () => {
        if (typeof lottie === 'undefined' || typeof pako === 'undefined') {
            Utils.log('error', 'Required libraries failed to load');
            return;
        }
        Utils.log('info', 'Required libraries loaded successfully');
    });
}

window.TGSLoader = {
    /**
     * Предустановленные конфигурации анимаций для разных экранов
     */
    presets: {
        // Конфигурация для экрана подписок
        subscription: [
            {
                containerId: 'tgs-animation-container',
                tgsPath: 'assets/images/gifs/empty-profiles.tgs',
                fallbackIcon: 'fas fa-ghost'
            },
            {
                containerId: 'trial-gift-tgs',
                tgsPath: 'assets/images/gifs/gift-animate.tgs',
                fallbackIcon: 'fas fa-gift',
                conditional: true // Будет загружен только если элемент существует
            },
            {
                containerId: 'trial-used-tgs',
                tgsPath: 'assets/images/gifs/gift-opened.png',
                fallbackIcon: 'fas fa-gift-card',
                conditional: true
            }
        ],

        // Конфигурация для экрана рефералов
        referrals: [
            {
                containerId: 'referrals-main-animation',
                tgsPath: 'assets/images/gifs/referral-main.tgs',
                fallbackIcon: 'fas fa-users'
            },
            {
                containerId: 'referrals-empty-animation',
                tgsPath: 'assets/images/gifs/empty-referrals.tgs',
                fallbackIcon: 'fas fa-user-plus'
            }
        ],

        // Конфигурация для экрана ключей
        keys: [
            {
                containerId: 'keys-main-animation',
                tgsPath: 'assets/images/gifs/keys-main.tgs',
                fallbackIcon: 'fas fa-key'
            },
            {
                containerId: 'keys-empty-animation',
                tgsPath: 'assets/images/gifs/empty-keys.tgs',
                fallbackIcon: 'fas fa-key'
            }
        ],

        // Конфигурация для экрана платежей
        payments: [
            {
                containerId: 'payments-empty-animation',
                tgsPath: 'assets/images/gifs/empty-payments.tgs',
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
     * Активные анимации по экранам (для cleanup)
     */
    activeAnimations: new Map(),

    /**
     * Загрузка TGS анимации с fallback
     */
    async loadTGSAnimation(containerId, tgsPath, fallbackIcon = 'fas fa-gift') {
        const container = document.getElementById(containerId);
        if (!container) {
            Utils.log('warn', `TGS Container not found: ${containerId}`);
            return;
        }

        // Проверяем доступность библиотек
        if (typeof lottie === 'undefined') {
            Utils.log('error', 'Lottie library not loaded');
            this.setFallbackIcon(container, fallbackIcon);
            return;
        }

        if (typeof pako === 'undefined') {
            Utils.log('error', 'Pako library not loaded');
            this.setFallbackIcon(container, fallbackIcon);
            return;
        }

        try {
            const response = await fetch(tgsPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch TGS: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const decompressed = pako.ungzip(uint8Array, { to: 'string' });
            const animationData = JSON.parse(decompressed);

            // Очищаем контейнер
            container.innerHTML = '';

            // Загружаем анимацию
            const animation = lottie.loadAnimation({
                container: container,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                animationData: animationData
            });

            // Сохраняем ссылку для cleanup
            container.lottieAnimation = animation;

            Utils.log('info', `TGS animation loaded: ${containerId}`);

        } catch (error) {
            Utils.log('error', `Failed to load TGS ${tgsPath}:`, error);
            this.setFallbackIcon(container, fallbackIcon);
        }
    },

    /**
     * Установка fallback иконки
     */
    setFallbackIcon(container, iconClass) {
        const size = Math.min(container.offsetWidth, container.offsetHeight) || 48;
        container.innerHTML = `<i class="${iconClass}" style="font-size: ${size}px; color: var(--accent-white);"></i>`;
    },

    /**
     * 🎯 ГЛАВНЫЙ МЕТОД: Инициализация анимаций по имени экрана
     * @param {string} screenName - Имя экрана (subscription, referrals, keys, payments)
     * @param {Object} customConfig - Дополнительные анимации (опционально)
     */
    async initializeScreen(screenName, customConfig = {}) {
        Utils.log('info', `Initializing TGS animations for screen: ${screenName}`);

        // Получаем предустановленную конфигурацию
        const preset = this.presets[screenName];
        if (!preset) {
            Utils.log('warn', `No TGS preset found for screen: ${screenName}`);
            return;
        }

        // Подготавливаем список анимаций для загрузки
        const animationsToLoad = [];

        preset.forEach(config => {
            // Если анимация условная, проверяем существование элемента
            if (config.conditional) {
                const element = document.getElementById(config.containerId);
                if (!element) {
                    Utils.log('debug', `Conditional TGS element not found, skipping: ${config.containerId}`);
                    return;
                }

                // Для условных элементов берем tgsPath из data-tgs атрибута
                const dataTgsPath = element.getAttribute('data-tgs');
                if (dataTgsPath) {
                    config.tgsPath = dataTgsPath;
                }
            }

            animationsToLoad.push(config);
        });

        // Добавляем кастомные анимации если есть
        if (customConfig.animations) {
            animationsToLoad.push(...customConfig.animations);
        }

        // Загружаем все анимации
        const promises = animationsToLoad.map(({ containerId, tgsPath, fallbackIcon }) =>
            this.loadTGSAnimation(containerId, tgsPath, fallbackIcon)
        );

        try {
            await Promise.allSettled(promises);

            // Сохраняем информацию об активных анимациях для cleanup
            this.activeAnimations.set(screenName, animationsToLoad.map(a => a.containerId));

            Utils.log('info', `Initialized ${animationsToLoad.length} TGS animations for ${screenName}`);
        } catch (error) {
            Utils.log('error', `Failed to initialize some TGS animations for ${screenName}:`, error);
        }
    },

    /**
     * 🧹 Очистка анимаций для конкретного экрана
     * @param {string} screenName - Имя экрана
     */
    cleanupScreen(screenName) {
        const containerIds = this.activeAnimations.get(screenName);
        if (!containerIds) {
            Utils.log('debug', `No active animations to cleanup for screen: ${screenName}`);
            return;
        }

        containerIds.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container && container.lottieAnimation) {
                try {
                    container.lottieAnimation.destroy();
                    delete container.lottieAnimation;
                    Utils.log('debug', `Cleaned up TGS animation: ${containerId}`);
                } catch (error) {
                    Utils.log('warn', `Failed to cleanup animation ${containerId}:`, error);
                }
            }
        });

        // Удаляем из активных анимаций
        this.activeAnimations.delete(screenName);
        Utils.log('info', `Cleaned up TGS animations for screen: ${screenName}`);
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
     * Пауза/возобновление анимаций экрана
     */
    toggleScreenAnimations(screenName, paused) {
        const containerIds = this.activeAnimations.get(screenName);
        if (!containerIds) return;

        containerIds.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container && container.lottieAnimation) {
                if (paused) {
                    container.lottieAnimation.pause();
                } else {
                    container.lottieAnimation.play();
                }
            }
        });
    },

    /**
     * Проверка доступности библиотек
     */
    isLibrariesAvailable() {
        return typeof lottie !== 'undefined' && typeof pako !== 'undefined';
    }
};