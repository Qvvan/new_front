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

            await new Promise(resolve => {
                if (window.TelegramApp.isInitialized) {
                    resolve();
                } else {
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
        Utils.log('info', 'Parsing referral data');

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const startParam = urlParams.get('startapp') || urlParams.get('start');

            if (startParam) {
                await this.handleReferralLink(startParam);
            }

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
            let referrerId = null;

            if (startParam.startsWith('ref_')) {
                referrerId = startParam.substring(4);
            } else if (/^\d+$/.test(startParam)) {
                referrerId = startParam;
            }

            if (referrerId) {
                Utils.log('info', `Referral detected: ${referrerId}`);

                if (window.Storage) {
                    await window.Storage.set('referrer_id', referrerId);
                }

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
            // Сначала получаем pending из API
            const pendingPayments = await window.PaymentAPI.getPendingPayments();

            if (pendingPayments.length > 0) {
                Utils.log('info', `Found ${pendingPayments.length} pending payments`);

                // Сохраняем в локальный список
                for (const payment of pendingPayments) {
                    await window.Storage.addPendingPayment(payment);
                }

                // Показываем баннер для последнего платежа
                const latestPayment = pendingPayments[pendingPayments.length - 1];
                if (window.PaymentBanner) {
                    window.PaymentBanner.show(latestPayment);
                }

                // Запускаем мониторинг
                if (window.PaymentMonitor) {
                    pendingPayments.forEach(payment => {
                        window.PaymentMonitor.addPayment(payment.id);
                    });
                    window.PaymentMonitor.start();
                }
            } else {
                // Очищаем локальный список если нет pending
                if (window.Storage) {
                    await window.Storage.clearPendingPayments();
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
        this.hideLoading();

        this.animateAppearance();

        await this.ensureUserRegistration();

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
        setInterval(() => {
            if (window.SubscriptionScreen) {
                window.SubscriptionScreen.checkExpiredSubscriptions();
            }
        }, 5 * 60 * 1000);

        setInterval(() => {
            if (window.Navigation) {
                window.Navigation.updateNavigationState();
            }
        }, 2 * 60 * 1000);

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
            Utils.log('info', 'Attempting app recovery');

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
     * Приложение стало активным
     */
    async onAppResume() {
        Utils.log('info', 'App resumed');

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
        Utils.log('info', 'App paused');

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

    async parseReferralData() {
        Utils.log('info', 'Parsing referral data');

        try {
            const referralData = window.ReferralParser.parseReferralData();

            if (referralData) {
                Utils.log('info', 'Referral detected:', referralData);

                this.pendingReferralData = referralData;

                if (window.Storage) {
                    await window.Storage.set('pending_referral', referralData);
                }
            }

        } catch (error) {
            Utils.log('error', 'Failed to parse referral data:', error);
        }
    },

    async ensureUserRegistration() {
        try {
            const userData = await window.Storage?.getUserData();
            const telegramUser = window.TelegramApp?.getUserInfo();

            if (!userData && telegramUser) {
                Utils.log('info', 'Registering new user');

                if (window.UserAPI) {
                    const result = await window.UserAPI.registerUser();
                    await window.Storage?.setUserData(result.user);

                    await this.processReferralAfterRegistration();
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
                    await window.Storage?.remove('pending_referral');
                }
            }
        } catch (error) {
            Utils.log('error', 'Failed to process referral after registration:', error);
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.DragonVPNApp.init();
        window.DragonVPNApp.handleLifecycleEvents();
    } catch (error) {
        console.error('Failed to start Dragon VPN App:', error);
    }
});