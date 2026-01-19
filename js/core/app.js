window.DragonVPNApp = {
    isInitialized: false,
    isReady: false,
    initializationPromise: null,

    /**
     * Инициализация приложения
     */
    async init() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._performInit();
        return this.initializationPromise;
    },

    /**
     * Выполнение инициализации
     */
    async _performInit() {
        try {
            // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог инициализации

            if (window.Loading) {
                window.Loading.init();
            }

            this.showInitialLoading();

            if (window.Assets) {
                window.Assets.preloadAssets();
            }

            await this.initializeTelegram();

            await this.initializeStorage();

            await this.parseReferralData();

            await this.initializeComponents();

            await this.initializeScreens();

            await this.initializeRouter();

            await this.checkPendingPayments();

            await this.finalize();

            this.isInitialized = true;
            this.isReady = true;

            // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог успешной инициализации

        } catch (error) {
            Utils.log('error', 'App initialization failed:', error);
            await this.handleInitializationError(error);
        }
    },

    /**
     * Показ начальной загрузки
     */
    showInitialLoading() {
        const loadingSteps = [
            'Подключение к Telegram...',
            'Очистка кеша...',
            'Инициализация компонентов...',
            'Загрузка данных...',
            'Подготовка интерфейса...'
        ];

        try {
            if (window.Loading && window.Loading.overlay) {
                window.Loading.showSteps(loadingSteps, 0);
            } else {
                this.createFallbackLoading();
            }
        } catch (error) {
            Utils.log('error', 'Failed to show initial loading:', error);
        }
    },

    /**
     * Fallback загрузка если основная не работает
     */
    createFallbackLoading() {
        // ✅ ОПТИМИЗАЦИЯ: Упрощенный fallback без inline стилей
        const loadingEl = document.createElement('div');
        loadingEl.id = 'fallbackLoading';
        loadingEl.className = 'loading-overlay';
        loadingEl.innerHTML = '<div>Загрузка...</div>';
        document.body.appendChild(loadingEl);
    },

    /**
     * Инициализация Telegram WebApp
     */
    async initializeTelegram() {
        // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог

        if (window.TelegramApp) {
            // Инициализируем базовый функционал
            window.TelegramApp.init();

            // ✅ ОПТИМИЗАЦИЯ: Уменьшаем количество попыток и увеличиваем интервал
            await new Promise(resolve => {
                let attempts = 0;
                const maxAttempts = 20; // Уменьшено с 100 до 20
                const checkInterval = 100; // Увеличено с 50 до 100ms

                const checkReady = () => {
                    attempts++;

                    if (window.TelegramApp.isInitialized) {
                        // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        // ✅ ОПТИМИЗАЦИЯ: Логируем только предупреждения в dev режиме
                        Utils.log('warn', 'Telegram WebApp initialization timeout');
                        resolve();
                    } else {
                        setTimeout(checkReady, checkInterval);
                    }
                };

                setTimeout(checkReady, checkInterval);
            });

            // 🔥 После инициализации принудительно настраиваем полуполноэкранный режим
            if (window.TelegramApp.webApp) {
                // Дополнительная настройка для устойчивости
                setTimeout(() => {
                    window.TelegramApp.forceExpand();

                    // Проверяем что настройки применились
                    if (!window.TelegramApp.webApp.isExpanded) {
                        // ✅ ОПТИМИЗАЦИЯ: Логируем только предупреждения
                        Utils.log('warn', 'App expansion may have failed');
                        // Повторная попытка
                        setTimeout(() => {
                            window.TelegramApp.forceExpand();
                        }, 1000);
                    }
                }, 200);
            }
        }

        if (window.Loading) {
            window.Loading.showSteps(['', 'Полуполноэкранный режим активирован...'], 1);
        }
    },

    /**
     * Инициализация системы хранилища
     */
    async initializeStorage() {
        Utils.log('info', 'Initializing Storage System with cleanup');

        if (window.Storage) {
            await window.Storage.init();
        }

        if (window.Loading) {
            window.Loading.showSteps(['', 'Загрузка данных пользователя...'], 1);
        }
    },

    /**
     * Парсинг реферальных данных
     */
    async parseReferralData() {
        // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог

        try {
            let referrerId = null;

            // 1. Проверяем URL параметры
            const urlParams = new URLSearchParams(window.location.search);
            const startParam = urlParams.get('startapp') || urlParams.get('start');

            if (startParam) {
                referrerId = this.extractReferrerId(startParam);
            }

            // 2. Проверяем Telegram WebApp start_param
            if (!referrerId && window.TelegramApp?.webApp?.initDataUnsafe?.start_param) {
                referrerId = this.extractReferrerId(window.TelegramApp.webApp.initDataUnsafe.start_param);
            }

            // 3. Проверяем hash параметры (для веб-версии)
            if (!referrerId && window.location.hash) {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const hashStart = hashParams.get('startapp') || hashParams.get('start');
                if (hashStart) {
                    referrerId = this.extractReferrerId(hashStart);
                }
            }

            if (referrerId) {
                // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог
                this.pendingReferrerId = referrerId;

                // Сохраняем для передачи при регистрации
                if (window.Storage) {
                    await window.Storage.set('pending_referrer_id', referrerId);
                }
            }

        } catch (error) {
            Utils.log('error', 'Failed to parse referral data:', error);
        }
    },

    extractReferrerId(startParam) {
        if (!startParam) return null;

        // Формат: ref_123456 или просто 123456
        if (startParam.startsWith('ref_')) {
            return startParam.substring(4);
        }

        // Проверяем что это число
        if (/^\d+$/.test(startParam)) {
            return startParam;
        }

        return null;
    },


    /**
     * Инициализация компонентов
     */
    async initializeComponents() {
        // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог

        // ✅ Инициализируем в правильном порядке
        if (window.Toast) window.Toast.init();
        if (window.Modal) window.Modal.init();
        if (window.Loading) window.Loading.init();

        // ✅ Сначала Router
        if (window.Router) {
            window.Router.init();
        }

        // ✅ Потом Navigation (без дублирования обработчиков)
        if (window.Navigation) {
            window.Navigation.init();
        }

        if (window.PaymentBanner) window.PaymentBanner.init();
    },

    /**
     * Инициализация экранов
     */
    async initializeScreens() {
        // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог
        if (window.SubscriptionScreen) {
            await window.SubscriptionScreen.init();
        }

        if (window.Loading) {
            window.Loading.showSteps(['', '', '', '', 'Подготовка интерфейса...'], 4);
        }
    },

    /**
     * Инициализация роутера
     */
    async initializeRouter() {
        Utils.log('info', 'Initializing router');

        if (window.Router) {
            window.Router.init();
        }

        if (window.Navigation) {
            window.Navigation.handleAppEvents();
            await window.Navigation.updateNavigationState();
        }
    },

    /**
     * Проверка pending платежей
     */
    async checkPendingPayments() {
        try {
            // Очищаем старые данные
            if (window.Storage) {
                await window.Storage.clearPendingPayments();
            }

            // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог

            // Получаем user_id из текущего пользователя
            let userId = null;
            try {
                const user = await window.UserAPI.getCurrentUser();
                userId = user.telegram_id || user.user_id;
            } catch (error) {
                Utils.log('error', 'Failed to get user ID:', error);
            }

            if (!userId) {
                Utils.log('warn', 'User ID not available, skipping pending payments check');
                return;
            }

            const response = await window.PaymentAPI.listPayments(userId, { limit: 50, offset: 0 });
            const allPayments = response.payments || [];

            // ✅ СТРОГО фильтруем только pending
            const actualPendingPayments = allPayments.filter(payment =>
                payment.status === 'pending'
            );

            // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог

            if (actualPendingPayments.length > 0) {
                // Сохраняем в сессионный кеш с правильными полями
                for (const payment of actualPendingPayments) {
                    // ✅ Для pending платежей используем confirmation_url (ссылка на оплату)
                    const paymentUrl = payment.confirmation_url || payment.receipt_link || payment.url;
                    const paymentWithUrl = {
                        ...payment,
                        payment_url: paymentUrl,
                        url: paymentUrl,
                        confirmation_url: paymentUrl
                    };

                    await window.Storage.addPendingPayment(paymentWithUrl);
                }

                // Показываем баннер для самого старого pending платежа (первого в списке)
                // Сортируем по дате создания (старые первыми)
                const sortedPending = [...actualPendingPayments].sort((a, b) => 
                    new Date(a.created_at) - new Date(b.created_at)
                );
                const oldestPayment = sortedPending[0];
                
                if (window.PaymentBanner && oldestPayment) {
                    const paymentUrl = oldestPayment.confirmation_url || oldestPayment.receipt_link || oldestPayment.url;
                    window.PaymentBanner.show({
                        ...oldestPayment,
                        payment_url: paymentUrl,
                        url: paymentUrl,
                        confirmation_url: paymentUrl
                    });
                }

                // Запускаем мониторинг
                if (window.PaymentMonitor) {
                    actualPendingPayments.forEach(payment => {
                        const paymentId = payment.payment_id || payment.id;
                        if (paymentId) {
                            window.PaymentMonitor.addPayment(paymentId);
                        }
                    });
                }
            }

        } catch (error) {
            Utils.log('error', 'Failed to check pending payments:', error);
            // Очищаем при ошибке
            if (window.Storage) {
                await window.Storage.clearPendingPayments();
            }
        }
    },

    /**
     * Финализация инициализации
     */
    async finalize() {
        this.hideLoading();

        this.animateAppearance();

        await this.ensureUserRegistration();

        this.setupPeriodicTasks();

        // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог
    },

    /**
     * Анимация появления приложения
     */
    animateAppearance() {
        // ✅ ОПТИМИЗАЦИЯ: Упрощенная анимация без лишних таймеров
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen) {
            activeScreen.classList.add('animate-fade-in');
        }
    },

    /**
     * Скрытие всех загрузок
     */
    hideLoading() {
        try {
            if (window.Loading) {
                window.Loading.hide();
            }

            const fallbackLoading = document.getElementById('fallbackLoading');
            if (fallbackLoading) {
                fallbackLoading.remove();
            }
        } catch (error) {
            Utils.log('error', 'Failed to hide loading:', error);
        }
    },

    /**
     * Регистрация пользователя
     */
    async ensureUserRegistration() {
        try {
            const userData = await window.Storage?.getUserData();
            const telegramUser = window.TelegramApp?.getUserInfo();

            if (!userData && telegramUser) {
                // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог

                const registrationData = {
                    referrer_id: this.pendingReferrerId || null
                };

                if (window.UserAPI) {
                    const referrerId = window.TelegramApp?.getReferrerId();
                    return await window.UserAPI.registerUser(referrerId);
                    await window.Storage?.setUserData(result.user);
                }
            }
        } catch (error) {
            Utils.log('error', 'User registration failed:', error);
        }
    },

    /**
     * Настройка периодических задач
     */
    setupPeriodicTasks() {
        // ✅ ОПТИМИЗАЦИЯ: Останавливаем задачи когда страница не видна
        let subscriptionInterval, navigationInterval, storageInterval;
        let isTasksRunning = false;

        const startTasks = () => {
            // Не запускаем если уже запущены или страница скрыта
            if (isTasksRunning || document.hidden) return;
            isTasksRunning = true;

            // ✅ ОПТИМИЗАЦИЯ: Увеличиваем интервалы для снижения нагрузки
            // Проверка истекших подписок каждые 10 минут (было 5)
            subscriptionInterval = setInterval(() => {
                if (!document.hidden && window.SubscriptionScreen && window.SubscriptionScreen.isLoaded) {
                    window.SubscriptionScreen.checkExpiredSubscriptions();
                }
            }, 10 * 60 * 1000);

            // Обновление навигации каждые 5 минут (было 2)
            navigationInterval = setInterval(() => {
                if (!document.hidden && window.Navigation) {
                    window.Navigation.updateNavigationState();
                }
            }, 5 * 60 * 1000);

            // Синхронизация Storage каждые 15 минут (было 10)
            storageInterval = setInterval(() => {
                if (!document.hidden && window.Storage) {
                    window.Storage.sync();
                }
            }, 15 * 60 * 1000);
        };

        const stopTasks = () => {
            if (subscriptionInterval) {
                clearInterval(subscriptionInterval);
                subscriptionInterval = null;
            }
            if (navigationInterval) {
                clearInterval(navigationInterval);
                navigationInterval = null;
            }
            if (storageInterval) {
                clearInterval(storageInterval);
                storageInterval = null;
            }
            isTasksRunning = false;
        };

        // ✅ ОПТИМИЗАЦИЯ: Управление задачами в зависимости от видимости страницы
        const handleVisibilityChange = () => {
            if (document.hidden || document.visibilityState === 'hidden') {
                stopTasks();
            } else {
                startTasks();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Запускаем задачи при старте (только если страница видна)
        if (!document.hidden) {
            startTasks();
        }
    },

    /**
     * Обработка ошибки инициализации
     */
    async handleInitializationError(error) {
        Utils.log('error', 'Critical initialization error:', error);

        if (window.Loading) {
            window.Loading.hide();
        }

        if (window.TelegramApp) {
            await window.TelegramApp.showAlert('Ошибка запуска приложения. Попробуйте перезапустить.');
        } else {
            alert('Ошибка запуска приложения. Попробуйте перезапустить.');
        }

        setTimeout(() => {
            this.attemptRecovery();
        }, 2000);
    },

    /**
     * Попытка восстановления после ошибки
     */
    async attemptRecovery() {
        try {
            // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог

            this.isInitialized = false;
            this.isReady = false;
            this.initializationPromise = null;

            await this.init();

        } catch (error) {
            Utils.log('error', 'Recovery failed:', error);

            if (window.TelegramApp) {
                const restart = await window.TelegramApp.showConfirm(
                    'Не удалось восстановить приложение. Перезагрузить страницу?'
                );
                if (restart) {
                    window.location.reload();
                }
            }
        }
    },

    /**
     * Обработка lifecycle событий
     */
    handleLifecycleEvents() {
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && this.isReady) {
                await this.onAppResume();
                // ✅ ОПТИМИЗАЦИЯ: Возобновляем CSS анимации когда страница видна
                this.resumeAnimations();
            } else if (document.hidden) {
                // ✅ ОПТИМИЗАЦИЯ: Останавливаем CSS анимации когда страница скрыта
                this.pauseAnimations();
            }
        });

        window.addEventListener('beforeunload', () => {
            this.onAppPause();
        });

        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason);
        });
    },

    /**
     * ✅ ОПТИМИЗАЦИЯ: Остановка бесконечных CSS анимаций когда страница скрыта
     */
    pauseAnimations() {
        // Добавляем класс на body для CSS селекторов
        document.body.classList.add('page-hidden');
        
        // Останавливаем все элементы с бесконечными анимациями
        const animatedElements = document.querySelectorAll(
            '.background-glow, .skeleton, [class*="infinite"], [style*="animation"]'
        );
        
        animatedElements.forEach(el => {
            const computedStyle = window.getComputedStyle(el);
            const animation = computedStyle.animation || computedStyle.webkitAnimation;
            
            // Проверяем что анимация бесконечная
            if (animation && animation.includes('infinite')) {
                if (el.style.animationPlayState !== 'paused') {
                    el.dataset.animationState = el.style.animationPlayState || 'running';
                    el.style.animationPlayState = 'paused';
                }
            }
        });
    },

    /**
     * ✅ ОПТИМИЗАЦИЯ: Возобновление CSS анимаций когда страница видна
     */
    resumeAnimations() {
        // Убираем класс с body
        document.body.classList.remove('page-hidden');
        
        // Возобновляем все остановленные анимации
        const animatedElements = document.querySelectorAll('[data-animation-state]');
        animatedElements.forEach(el => {
            el.style.animationPlayState = el.dataset.animationState || 'running';
            delete el.dataset.animationState;
        });
    },

    /**
     * Приложение стало активным
     */
    async onAppResume() {
        // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог

        try {
            await this.refreshAppData();

            await this.checkPendingPayments();

            if (window.Navigation) {
                await window.Navigation.updateNavigationState();
            }

        } catch (error) {
            Utils.log('error', 'Failed to handle app resume:', error);
        }
    },

    /**
     * Приложение уходит в фон
     */
    onAppPause() {
        // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог

        if (window.Storage) {
            window.Storage.updateLastActivity();
        }
    },

    /**
     * Обновление данных приложения
     */
    async refreshAppData() {
        try {
            if (window.SubscriptionScreen && window.SubscriptionScreen.isLoaded) {
                await window.SubscriptionScreen.refresh();
            }

            if (window.Storage) {
                await window.Storage.sync();
            }

        } catch (error) {
            Utils.log('error', 'Failed to refresh app data:', error);
        }
    },

    /**
     * Обработка глобальных ошибок
     */
    handleGlobalError(error) {
        Utils.log('error', 'Global error caught:', error);

        if (error.message && error.message.includes('Network')) {
            if (window.Toast) {
                window.Toast.networkError();
            }
        }
    },

    /**
     * Проверка готовности приложения
     */
    isAppReady() {
        return this.isReady;
    },


    /**
     * Перезапуск приложения
     */
    async restart() {
        // ✅ ОПТИМИЗАЦИЯ: Убрали избыточный лог

        try {
            this.cleanup();

            await this.init();

            if (window.Toast) {
                window.Toast.success('Приложение перезапущено');
            }

        } catch (error) {
            Utils.log('error', 'Restart failed:', error);
            window.location.reload();
        }
    },

    /**
     * Очистка приложения
     */
    cleanup() {
        if (window.Toast) window.Toast.cleanup();
        if (window.Modal) window.Modal.cleanup();
        if (window.Loading) window.Loading.cleanup();
        if (window.Navigation) window.Navigation.cleanup();
        if (window.SubscriptionScreen) window.SubscriptionScreen.cleanup();

        this.isInitialized = false;
        this.isReady = false;
        this.initializationPromise = null;
        this.pendingReferrerId = null;
    },


};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.DragonVPNApp.init();
        window.DragonVPNApp.handleLifecycleEvents();
    } catch (error) {
        Utils.log('error', 'Failed to start Dragon VPN App:', error);
    }
});