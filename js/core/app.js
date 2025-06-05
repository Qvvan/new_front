// Main Application File for Dragon VPN Mini App

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
            Utils.log('info', 'Dragon VPN App initialization started');

            // 1. Инициализируем Loading без показа
            if (window.Loading) {
                window.Loading.init();
            }

            // 2. Показываем загрузку
            this.showInitialLoading();

            if (window.Assets) {
                window.Assets.preloadAssets();
            }

            // 3. Инициализация Telegram WebApp
            await this.initializeTelegram();

            // 4. Инициализация системы хранилища с очисткой
            await this.initializeStorage();

            // 5. Парсинг реферальных ссылок
            await this.parseReferralData();

            // 6. Инициализация компонентов
            await this.initializeComponents();

            // 7. Инициализация экранов
            await this.initializeScreens();

            // 8. Настройка роутера
            await this.initializeRouter();

            // 9. Проверка pending платежей
            await this.checkPendingPayments();

            // 10. Финализация
            await this.finalize();

            this.isInitialized = true;
            this.isReady = true;

            Utils.log('info', 'Dragon VPN App initialized successfully');

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
                // Fallback - создаем простую загрузку
                this.createFallbackLoading();
            }
        } catch (error) {
            Utils.log('error', 'Failed to show initial loading:', error);
            // Продолжаем без загрузки
        }
    },

    /**
     * Fallback загрузка если основная не работает
     */
    createFallbackLoading() {
        const loadingEl = document.createElement('div');
        loadingEl.id = 'fallbackLoading';
        loadingEl.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #0d0d0d;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            color: white;
            font-family: system-ui;
        `;
        loadingEl.innerHTML = '<div>Загрузка Dragon VPN...</div>';
        document.body.appendChild(loadingEl);
    },

    /**
     * Инициализация Telegram WebApp
     */
    async initializeTelegram() {
        Utils.log('info', 'Initializing Telegram WebApp');

        if (window.TelegramApp) {
            window.TelegramApp.init();

            // Более надежное ожидание готовности
            await new Promise(resolve => {
                if (window.TelegramApp.isInitialized) {
                    resolve();
                } else {
                    // Проверяем каждые 100мс до 5 секунд
                    let attempts = 0;
                    const maxAttempts = 50;

                    const checkReady = () => {
                        attempts++;
                        if (window.TelegramApp.isInitialized || attempts >= maxAttempts) {
                            resolve();
                        } else {
                            setTimeout(checkReady, 100);
                        }
                    };

                    setTimeout(checkReady, 100);
                }
            });
        }

        if (window.Loading) {
            window.Loading.showSteps(['', 'Загрузка данных пользователя...'], 1);
        }
    },

    /**
     * Инициализация системы хранилища
     */
    async initializeStorage() {
        Utils.log('info', 'Initializing Storage System with cleanup');

        if (window.Storage) {
            await window.Storage.init(); // Теперь включает очистку стейл кеша
            // НЕ вызываем sync() - только актуальные данные
        }

        if (window.Loading) {
            window.Loading.showSteps(['', 'Загрузка данных пользователя...'], 1);
        }
    },

    /**
     * Парсинг реферальных данных
     */
    async parseReferralData() {
        Utils.log('info', 'Parsing referral data');

        try {
            // Проверяем URL на наличие реферальных параметров
            const urlParams = new URLSearchParams(window.location.search);
            const startParam = urlParams.get('startapp') || urlParams.get('start');

            if (startParam) {
                // Парсим реферальную ссылку
                await this.handleReferralLink(startParam);
            }

            // Также проверяем Telegram initData
            if (window.TelegramApp && window.TelegramApp.webApp) {
                const initDataUnsafe = window.TelegramApp.webApp.initDataUnsafe;
                if (initDataUnsafe && initDataUnsafe.start_param) {
                    await this.handleReferralLink(initDataUnsafe.start_param);
                }
            }

        } catch (error) {
            Utils.log('error', 'Failed to parse referral data:', error);
        }

        if (window.Loading) {
            window.Loading.showSteps(['', '', 'Инициализация компонентов...'], 2);
        }
    },

    /**
     * Обработка реферальной ссылки
     */
    async handleReferralLink(startParam) {
        try {
            // Ожидаем формат: ref_USER_ID или просто USER_ID
            let referrerId = null;

            if (startParam.startsWith('ref_')) {
                referrerId = startParam.substring(4);
            } else if (/^\d+$/.test(startParam)) {
                referrerId = startParam;
            }

            if (referrerId) {
                Utils.log('info', `Referral detected: ${referrerId}`);

                // Сохраняем реферальные данные
                if (window.Storage) {
                    await window.Storage.set('referrer_id', referrerId);
                }

                // Отправляем на сервер при регистрации пользователя
                this.pendingReferrerId = referrerId;
            }

        } catch (error) {
            Utils.log('error', 'Failed to handle referral link:', error);
        }
    },

    /**
     * Инициализация компонентов
     */
    async initializeComponents() {
        Utils.log('info', 'Initializing components');

        // Базовые компоненты
        if (window.Toast) {
            window.Toast.init();
        }

        if (window.Modal) {
            window.Modal.init();
        }

        if (window.Loading) {
            window.Loading.init();
        }

        if (window.Navigation) {
            window.Navigation.init();
        }

        // Новые компоненты
        if (window.PaymentBanner) {
            window.PaymentBanner.init();
        }

        if (window.Loading) {
            window.Loading.showSteps(['', '', '', 'Проверка подписок...'], 3);
        }
    },

    /**
     * Инициализация экранов
     */
    async initializeScreens() {
        Utils.log('info', 'Initializing screens');

        // Инициализируем только экран подписок по умолчанию
        // Остальные экраны будут инициализированы при переходе к ним
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
            const pendingPayments = await window.Storage?.getPendingPayments() || [];

            if (pendingPayments.length > 0) {
                Utils.log('info', `Found ${pendingPayments.length} pending payments`);

                // Показываем плашку оплаты для первого pending платежа
                const latestPayment = pendingPayments[pendingPayments.length - 1];
                if (window.PaymentBanner) {
                    window.PaymentBanner.show(latestPayment);
                }

                // Запускаем мониторинг платежей
                if (window.PaymentMonitor) {
                    window.PaymentMonitor.start();
                }
            }
        } catch (error) {
            Utils.log('error', 'Failed to check pending payments:', error);
        }
    },

    /**
     * Финализация инициализации
     */
    async finalize() {
        // Скрываем любую загрузку
        this.hideLoading();

        // Анимация появления интерфейса
        this.animateAppearance();

        // Регистрируем пользователя если нужно (БЕЗ кеширования)
        await this.ensureUserRegistration();

        // Настраиваем периодические задачи
        this.setupPeriodicTasks();

        Utils.log('info', 'App finalization completed');
    },

    /**
     * Анимация появления приложения
     */
    animateAppearance() {
        const screens = document.querySelectorAll('.screen');
        const navigation = document.querySelector('.bottom-nav');

        screens.forEach(screen => {
            screen.classList.add('animate-fade-in');
        });

        if (navigation) {
            // ❌ Убираем translateX(-50%) так как теперь left: 0
            navigation.style.transform = 'translateY(100%)';
            setTimeout(() => {
                navigation.style.transition = 'transform 0.3s ease';
                navigation.style.transform = 'translateY(0)';
            }, 200);
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

            // Убираем fallback загрузку
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
                Utils.log('info', 'Registering new user');

                const registrationData = {
                    referrer_id: this.pendingReferrerId || null
                };

                if (window.UserAPI) {
                    const result = await window.UserAPI.registerUser(registrationData);
                    await window.Storage?.setUserData(result.user);

                    if (window.Toast) {
                        window.Toast.success('Добро пожаловать в Dragon VPN!');
                    }
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
        // Проверка состояния подписок каждые 5 минут
        setInterval(() => {
            if (window.SubscriptionScreen) {
                window.SubscriptionScreen.checkExpiredSubscriptions();
            }
        }, 5 * 60 * 1000);

        // Обновление навигации каждые 2 минуты
        setInterval(() => {
            if (window.Navigation) {
                window.Navigation.updateNavigationState();
            }
        }, 2 * 60 * 1000);

        // Синхронизация данных каждые 10 минут
        setInterval(() => {
            if (window.Storage) {
                window.Storage.sync();
            }
        }, 10 * 60 * 1000);
    },

    /**
     * Обработка ошибки инициализации
     */
    async handleInitializationError(error) {
        Utils.log('error', 'Critical initialization error:', error);

        // Скрываем загрузку
        if (window.Loading) {
            window.Loading.hide();
        }

        // Показываем ошибку
        if (window.TelegramApp) {
            await window.TelegramApp.showAlert('Ошибка запуска приложения. Попробуйте перезапустить.');
        } else {
            alert('Ошибка запуска приложения. Попробуйте перезапустить.');
        }

        // Попытка восстановления
        setTimeout(() => {
            this.attemptRecovery();
        }, 2000);
    },

    /**
     * Попытка восстановления после ошибки
     */
    async attemptRecovery() {
        try {
            Utils.log('info', 'Attempting app recovery');

            // Очищаем состояние
            this.isInitialized = false;
            this.isReady = false;
            this.initializationPromise = null;

            // Перезапускаем инициализацию
            await this.init();

        } catch (error) {
            Utils.log('error', 'Recovery failed:', error);

            // Если восстановление не удалось, предлагаем перезагрузку
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
        // Приложение становится активным
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && this.isReady) {
                await this.onAppResume();
            }
        });

        // Перед закрытием приложения
        window.addEventListener('beforeunload', () => {
            this.onAppPause();
        });

        // Обработка ошибок
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason);
        });
    },

    /**
     * Приложение стало активным
     */
    async onAppResume() {
        Utils.log('info', 'App resumed');

        try {
            // Обновляем данные
            await this.refreshAppData();

            // Проверяем pending платежи
            await this.checkPendingPayments();

            // Обновляем навигацию
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
        Utils.log('info', 'App paused');

        // Сохраняем последнюю активность
        if (window.Storage) {
            window.Storage.updateLastActivity();
        }
    },

    /**
     * Обновление данных приложения
     */
    async refreshAppData() {
        try {
            // Обновляем подписки
            if (window.SubscriptionScreen && window.SubscriptionScreen.isLoaded) {
                await window.SubscriptionScreen.refresh();
            }

            // Синхронизируем хранилище
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

        // Показываем пользователю только критические ошибки
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
     * Получение статуса приложения
     */
    getAppStatus() {
        return {
            isInitialized: this.isInitialized,
            isReady: this.isReady,
            currentScreen: window.Router?.getCurrentScreen(),
            hasActiveModals: window.Modal?.hasActiveModals(),
            pendingPayments: window.Storage?.getPendingPayments().length || 0,
            lastActivity: window.Storage?.getLastActivity()
        };
    },

    /**
     * Перезапуск приложения
     */
    async restart() {
        Utils.log('info', 'Restarting application');

        try {
            // Очищаем все компоненты
            this.cleanup();

            // Перезапускаем инициализацию
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
        // Очищаем компоненты
        if (window.Toast) window.Toast.cleanup();
        if (window.Modal) window.Modal.cleanup();
        if (window.Loading) window.Loading.cleanup();
        if (window.Navigation) window.Navigation.cleanup();
        if (window.SubscriptionScreen) window.SubscriptionScreen.cleanup();

        // Сбрасываем состояние
        this.isInitialized = false;
        this.isReady = false;
        this.initializationPromise = null;
        this.pendingReferrerId = null;
    },

    async parseReferralData() {
        Utils.log('info', 'Parsing referral data');

        try {
            const referralData = window.ReferralParser.parseReferralData();

            if (referralData) {
                Utils.log('info', 'Referral detected:', referralData);

                // Сохраняем для обработки после регистрации
                this.pendingReferralData = referralData;

                // Сохраняем в Storage
                if (window.Storage) {
                    await window.Storage.set('pending_referral', referralData);
                }
            }

        } catch (error) {
            Utils.log('error', 'Failed to parse referral data:', error);
        }
    },

    // И в методе ensureUserRegistration() добавляем:

    async ensureUserRegistration() {
        try {
            const userData = await window.Storage?.getUserData();
            const telegramUser = window.TelegramApp?.getUserInfo();

            if (!userData && telegramUser) {
                Utils.log('info', 'Registering new user');

                // Регистрируем пользователя
                if (window.UserAPI) {
                    const result = await window.UserAPI.registerUser();
                    await window.Storage?.setUserData(result.user);

                    // Обрабатываем реферал после регистрации
                    await this.processReferralAfterRegistration();

                    if (window.Toast) {
                        window.Toast.success('Добро пожаловать в Dragon VPN!');
                    }
                }
            }
        } catch (error) {
            Utils.log('error', 'User registration failed:', error);
        }
    },

    async processReferralAfterRegistration() {
        try {
            const pendingReferral = await window.Storage?.get('pending_referral');

            if (pendingReferral && window.ReferralParser) {
                const success = await window.ReferralParser.submitReferral(pendingReferral);

                if (success) {
                    // Показываем бонус за реферал
                    if (window.Toast) {
                        window.Toast.success('🎁 Бонус за приглашение получен!');
                    }

                    // Очищаем pending данные
                    await window.Storage?.remove('pending_referral');
                }
            }
        } catch (error) {
            Utils.log('error', 'Failed to process referral after registration:', error);
        }
    }
};

// Автоматическая инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.DragonVPNApp.init();
        window.DragonVPNApp.handleLifecycleEvents();
    } catch (error) {
        console.error('Failed to start Dragon VPN App:', error);
    }
});