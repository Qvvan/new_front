// Router for Dragon VPN Mini App

window.Router = {
    currentScreen: 'subscription',
    previousScreen: null,
    history: [],
    maxHistoryLength: 10,
    isNavigating: false,
    isDeepLinkActive: false, // ✅ Флаг для защиты deep link от перезаписи
    deepLinkParams: null, // ✅ Параметры из deep link
    _isInitialized: false, // ✅ Флаг инициализации для предотвращения повторной инициализации

    // Доступные экраны
    screens: {
        subscription: 'subscriptionScreen',
        keys: 'keysScreen',
        referrals: 'referralsScreen',
        payments: 'paymentsScreen',
        instructions: 'instructionsModal',  // ✅ Добавить
        support: 'supportModal'             // ✅ Добавить
    },

    modalScreens: ['instructions', 'support'],

    // Обработчики экранов
    screenHandlers: {
        subscription: () => window.SubscriptionScreen,
        keys: () => window.KeysScreen,
        referrals: () => window.ReferralsScreen,
        payments: () => window.PaymentsScreen,
        instructions: () => window.InstructionsScreen,
        support: () => window.SupportScreen
    },

    /**
     * Инициализация роутера
     */
    async init() {
        // ✅ Проверяем, не инициализирован ли уже роутер
        if (this._isInitialized) {
            return;
        }
        this._isInitialized = true;

        this.ensureExpanded();

        this.setupFullViewport();
        this.setupTelegramBackButton();
        this.setupNavigationEvents();
        
        // ✅ restoreState теперь async и должен быть вызван с await
        await this.restoreState();
        
        // ✅ Передаем параметры из deep link если есть
        // ✅ Добавляем флаг для защиты от перезаписи
        if (this.deepLinkParams) {
            console.log('[Deep Link] init - deepLinkParams found:', this.deepLinkParams);
            this.isDeepLinkActive = true;
            const params = this.deepLinkParams;
            this.deepLinkParams = null; // Очищаем после использования
            
            // ✅ Навигация с deep link параметрами
            console.log('[Deep Link] Navigating to:', this.currentScreen, 'with params:', params);
            await this.navigate(this.currentScreen, false, params);
            
            // ✅ Снимаем флаг после задержки, чтобы другие компоненты не перезаписали
            // Увеличиваем время для модальных окон (instructions, support)
            const delay = this.modalScreens.includes(this.currentScreen) ? 2000 : 1000;
            setTimeout(() => {
                this.isDeepLinkActive = false;
            }, delay);
        } else {
            // Обычная навигация без deep link
            await this.navigate(this.currentScreen, false);
        }
    },

    ensureExpanded() {
        if (window.TelegramApp && window.TelegramApp.webApp) {
            window.TelegramApp.forceExpand();

            // ✅ ОПТИМИЗАЦИЯ: Проверяем только при изменении viewport, а не постоянно
            // Используем событие viewportChanged вместо setInterval
            if (window.TelegramApp.webApp.onEvent) {
                window.TelegramApp.webApp.onEvent('viewportChanged', (eventData) => {
                    if (eventData && !eventData.isExpanded) {
                        window.TelegramApp.forceExpand();
                    }
                });
            }
        }
    },

    setupFullViewport() {
        // Устанавливаем CSS переменную высоты viewport
        const updateViewportHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);

            if (window.TelegramApp && window.TelegramApp.webApp) {
                const tgHeight = window.TelegramApp.webApp.viewportHeight;
                document.documentElement.style.setProperty('--tg-viewport-height', `${tgHeight}px`);
            }
        };

        // ✅ ОПТИМИЗАЦИЯ: Используем throttle для resize событий
        const throttledUpdate = Utils.throttle(updateViewportHeight, 100);

        // Обновляем при изменении размера
        window.addEventListener('resize', throttledUpdate);
        window.addEventListener('orientationchange', updateViewportHeight);

        // Обновляем при изменении Telegram viewport
        if (window.TelegramApp && window.TelegramApp.webApp) {
            window.TelegramApp.webApp.onEvent('viewportChanged', updateViewportHeight);
        }

        // Первоначальная установка
        updateViewportHeight();
    },

    /**
     * Навигация к экрану
     * @param {string} screenName - Название экрана
     * @param {boolean} addToHistory - Добавлять ли в историю
     * @param {Object} params - Параметры для экрана
     */
    async navigate(screenName, addToHistory = true, params = {}) {
        if (this.isNavigating) {
            return;
        }

        if (!this.screens[screenName]) {
            return;
        }

        // ✅ Защита: если активен deep link и это не тот же экран, блокируем навигацию
        // Разрешаем только если это навигация на тот же экран (например, инструкции с параметрами)
        if (this.isDeepLinkActive && screenName !== this.currentScreen) {
            // Разрешаем навигацию только если это модальный экран (instructions, support)
            // или если это явная навигация пользователя (addToHistory === true)
            const isModalScreen = this.modalScreens.includes(screenName);
            if (!isModalScreen && !addToHistory) {
                // Блокируем автоматическую навигацию во время deep link
                return;
            }
        }

        this.isNavigating = true;

        try {

            if (addToHistory && this.currentScreen !== screenName) {
                this.addToHistory(this.currentScreen);
            }

            // Сохраняем предыдущий экрран
            this.previousScreen = this.currentScreen;
            this.currentScreen = screenName;

            // Выполняем переход
            await this.performTransition(screenName, params);

            // Обновляем навигацию (с защитой от deep link)
            this.updateNavigation();
            this.updateTelegramBackButton();
            this.saveState();

            // ✅ Вибрация только один раз при успешном переходе
            if (window.TelegramApp && this.previousScreen !== screenName) {
                window.TelegramApp.haptic.selection();
            }

        } catch (error) {
        } finally {
            this.isNavigating = false;
        }
    },

    /**
     * Выполнение перехода между экранами
     */
    async performTransition(screenName, params) {
        const modalScreens = ['instructions', 'support'];
        const isModal = modalScreens.includes(screenName);

        if (isModal) {
            await this.showModal(screenName, params);
        } else {
            await this.showScreen(screenName, params);
        }
    },

    /**
     * Показ обычного экрана
     */
    async showScreen(screenName, params) {
        const screenElement = document.getElementById(this.screens[screenName]);
        if (!screenElement) return;

        // ✅ Убираем все промежуточные анимации
        Object.values(this.screens).forEach(screenId => {
            const screen = document.getElementById(screenId);
            if (screen && !screenId.includes('Modal')) {
                screen.classList.remove('active');
                screen.style.display = 'none'; // Мгновенное скрытие
            }
        });

        // ✅ Инициализируем экран до показа
        await this.initializeScreen(screenName, params);

        // ✅ Показываем БЕЗ анимации
        screenElement.style.display = 'block';
        screenElement.classList.add('active');

        // ✅ Обновляем навигацию ОДИН раз
        if (window.Navigation) {
            window.Navigation.updateActiveState(screenName);
        }
    },

    /**
     * Показ модального экрана
     */
    async showModal(screenName, params) {
        const handler = this.screenHandlers[screenName]?.();
        if (handler && typeof handler.show === 'function') {
            await handler.show(params);
        }
    },

    /**
     * Инициализация экрана
     */
    async initializeScreen(screenName, params) {
        const handler = this.screenHandlers[screenName]?.();

        if (handler) {
            // Если экран уже загружен - показываем его сразу без повторного рендеринга
            if (handler.isLoaded) {
                // ✅ Если есть параметры action из deep link, выполняем действие
                if (params && params.action) {
                    // Задержка для завершения рендеринга
                    setTimeout(async () => {
                        await this.handleDeepLinkAction(screenName, params);
                    }, 500);
                }
                // Не вызываем refresh чтобы избежать двойного рендеринга
                // Данные обновятся при следующем явном обновлении
                return; // Показываем экран сразу
            }

            // Только для первого раза делаем полную инициализацию
            if (typeof handler.init === 'function') {
                await handler.init(params);
            }

            // ✅ После инициализации выполняем действие из deep link если есть
            if (params && params.action) {
                // Увеличиваем задержку для завершения рендеринга и загрузки данных
                setTimeout(async () => {
                    await this.handleDeepLinkAction(screenName, params);
                }, 800);
            }
        }
    },

    /**
     * Обработка действий из deep link
     */
    async handleDeepLinkAction(screenName, params) {
        try {
            const action = params?.action;
            if (!action) return;

            switch (screenName) {
                case 'subscription':
                    await this.handleSubscriptionAction(action, params);
                    break;
                case 'support':
                    await this.handleSupportAction(action, params);
                    break;
                default:
                    // Для других экранов передаем параметры напрямую
                    break;
            }
        } catch (error) {
            // Логируем ошибку для отладки
            console.error('Deep link action error:', error);
        }
    },

    /**
     * Обработка действий для экрана подписки
     */
    async handleSubscriptionAction(action, params) {
        console.log('[Deep Link] handleSubscriptionAction:', action, params);
        const handler = this.screenHandlers.subscription?.();
        if (!handler) {
            console.error('[Deep Link] Subscription handler not found');
            return;
        }

        switch (action) {
            case 'services':
            case 'buy':
                // Открываем селектор услуг для покупки
                console.log('[Deep Link] Opening ServiceSelector with mode:', params.mode || 'buy');
                if (window.ServiceSelector) {
                    const mode = params.mode || 'buy';
                    const subscriptionId = params.subscription_id || params.subscriptionId;
                    const serviceId = params.service_id || params.serviceId;
                    
                    try {
                        await window.ServiceSelector.show(mode, subscriptionId);
                        console.log('[Deep Link] ServiceSelector opened');
                        
                        // Если указана конкретная услуга, выбираем её после загрузки
                        if (serviceId) {
                            setTimeout(() => {
                                if (window.ServiceSelector && window.ServiceSelector.selectService) {
                                    console.log('[Deep Link] Selecting service:', serviceId);
                                    window.ServiceSelector.selectService(serviceId);
                                }
                            }, 1000); // Увеличиваем задержку для загрузки услуг
                        }
                    } catch (error) {
                        console.error('[Deep Link] Error opening ServiceSelector:', error);
                    }
                } else {
                    console.error('[Deep Link] ServiceSelector not available');
                }
                break;

            case 'renew':
                // Продление конкретной подписки
                const subscriptionId = params.subscription_id || params.subscriptionId;
                if (subscriptionId && handler.handleRenewSubscription) {
                    await handler.handleRenewSubscription(subscriptionId);
                } else if (window.ServiceSelector) {
                    await window.ServiceSelector.show('renew', subscriptionId);
                }
                break;

            case 'gift':
                // Открываем процесс подарка
                const serviceId = params.service_id || params.serviceId;
                
                if (serviceId && window.ServiceSelector) {
                    // Если указана конкретная услуга, открываем ServiceSelector напрямую
                    await window.ServiceSelector.show('gift');
                    setTimeout(() => {
                        if (window.ServiceSelector && window.ServiceSelector.selectService) {
                            window.ServiceSelector.selectService(serviceId);
                        }
                    }, 800);
                } else if (window.GiftFlow) {
                    // Иначе открываем обычный процесс подарка
                    await window.GiftFlow.show();
                }
                break;

            case 'daily-bonus':
                // Открываем модальное окно ежедневных бонусов
                console.log('[Deep Link] Opening daily bonus modal');
                if (handler.showDailyBonusModal) {
                    try {
                        await handler.showDailyBonusModal();
                        console.log('[Deep Link] Daily bonus modal opened');
                    } catch (error) {
                        console.error('[Deep Link] Error opening daily bonus modal:', error);
                    }
                } else {
                    console.error('[Deep Link] showDailyBonusModal method not found');
                }
                break;

            case 'activate-code':
                // ✅ Открываем активацию кода с предзаполнением (если код указан)
                const code = params.code;
                if (handler.handleActivateCode) {
                    // Всегда показываем модальное окно, но если код указан - предзаполняем поле
                    await handler.handleActivateCode(code);
                }
                break;

            case 'news':
                // Открываем новости
                if (handler.handleNewsChannel) {
                    handler.handleNewsChannel();
                }
                break;
        }
    },

    /**
     * Обработка действий для экрана поддержки
     */
    async handleSupportAction(action, params) {
        const handler = this.screenHandlers.support?.();
        if (!handler) return;

        // Если указан FAQ, открываем его
        const faq = params.faq;
        if (faq && handler.showFAQ) {
            setTimeout(() => {
                handler.showFAQ(faq);
            }, 300);
        }
    },

    /**
     * Возврат назад
     */
    async goBack() {
        if (this.history.length > 0) {
            const previousScreen = this.history.pop();
            await this.navigate(previousScreen, false);
        } else if (this.previousScreen) {
            await this.navigate(this.previousScreen, false);
        } else {
            // Закрываем приложение
            if (window.TelegramApp) {
                window.TelegramApp.close();
            }
        }
    },

    /**
     * Добавление в историю
     */
    addToHistory(screenName) {
        if (screenName && screenName !== this.currentScreen) {
            this.history.push(screenName);

            // Ограничиваем размер истории
            if (this.history.length > this.maxHistoryLength) {
                this.history.shift();
            }
        }
    },

    /**
     * Обновление нижней навигации
     */
    updateNavigation() {
        // ✅ Не обновляем навигацию если активен deep link (защита от конфликтов)
        if (this.isDeepLinkActive) {
            return;
        }

        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            const screen = item.dataset.screen;
            item.classList.toggle('active', screen === this.currentScreen);
        });
    },

    /**
     * Настройка событий навигации
     */
    setupNavigationEvents() {
        // Обработка событий браузера (для разработки)
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.screen) {
                this.navigate(e.state.screen, false);
            }
        });

        // Обработка событий клавиатуры
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.handleEscape();
            }
        });
    },

    /**
     * Настройка кнопки назад в Telegram
     */
    setupTelegramBackButton() {
        if (!window.TelegramApp || !window.TelegramApp.webApp) return;

        // Обработчик кнопки назад уже настроен в telegram.js
        // Здесь просто обновляем видимость
        this.updateTelegramBackButton();
    },

    /**
     * Обновление кнопки назад в Telegram
     */
    updateTelegramBackButton() {
        if (!window.TelegramApp || !window.TelegramApp.webApp) return;

        // Всегда скрываем кнопку назад
        window.TelegramApp.hideBackButton();
    },

    /**
     * Обработка Escape
     */
    handleEscape() {
        // Если открыт модальный экран, закрываем его
        const modals = document.querySelectorAll('.modal-overlay.active');
        if (modals.length > 0) {
            modals[modals.length - 1].classList.remove('active');
            return;
        }

        // Иначе идем назад
        this.goBack();
    },

    /**
     * Получение текущего экрана
     */
    getCurrentScreen() {
        return this.currentScreen;
    },

    /**
     * Получение предыдущего экрана
     */
    getPreviousScreen() {
        return this.previousScreen;
    },

    /**
     * Проверка, можно ли вернуться назад
     */
    canGoBack() {
        return this.history.length > 0 || this.previousScreen !== null;
    },

    /**
     * Сохранение состояния роутера
     */
    saveState() {
        // ✅ Не сохраняем состояние если активен deep link (защита от перезаписи)
        if (this.isDeepLinkActive) {
            return;
        }

        const state = {
            currentScreen: this.currentScreen,
            previousScreen: this.previousScreen,
            history: this.history
        };

        if (window.Storage) {
            window.Storage.set('router_state', state);
        } else {
            localStorage.setItem('dragon_vpn_router_state', JSON.stringify(state));
        }
    },

    /**
     * Парсинг deep link из URL
     * Возвращает объект { screen, params } или null
     */
    parseDeepLink() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const hashParams = window.location.hash ? new URLSearchParams(window.location.hash.substring(1)) : null;
            
            // Собираем все параметры (query имеет приоритет над hash)
            const allParams = {};
            if (hashParams) {
                hashParams.forEach((value, key) => {
                    allParams[key] = value;
                });
            }
            urlParams.forEach((value, key) => {
                allParams[key] = value;
            });

            // ✅ Отладка: логируем все параметры
            if (Object.keys(allParams).length > 0) {
                console.log('[Deep Link] Parsed params:', allParams);
            }

            let screen = null;
            const params = {};

            // ✅ Специальные deep links (без screen параметра)
            // Проверяем наличие ключа (даже если значение пустое)
            const hasKey = (key) => {
                const exists = key in allParams;
                if (exists) {
                    console.log(`[Deep Link] Found key "${key}" with value:`, allParams[key]);
                }
                return exists;
            };
            
            // ✅ Также проверяем все ключи для отладки
            console.log('[Deep Link] All keys in params:', Object.keys(allParams));
            
            // 1. Активация кода (activate-code или activate-code=CODE)
            if (hasKey('activate-code') || hasKey('activate_code')) {
                screen = 'subscription';
                params.action = 'activate-code';
                const codeValue = allParams['activate-code'] || allParams.activate_code;
                if (codeValue) {
                    params.code = codeValue;
                }
                // Собираем остальные параметры
                Object.keys(allParams).forEach(key => {
                    if (key !== 'screen' && key !== 'activate-code' && key !== 'activate_code') {
                        params[key] = allParams[key];
                    }
                });
                return { screen, params };
            }

            // 2. Услуги (services)
            if (hasKey('services') || hasKey('service')) {
                screen = 'subscription';
                params.action = 'services';
                params.mode = allParams.mode || 'buy';
                if (allParams.service_id || allParams.serviceId) {
                    params.service_id = allParams.service_id || allParams.serviceId;
                }
                if (allParams.subscription_id || allParams.subscriptionId) {
                    params.subscription_id = allParams.subscription_id || allParams.subscriptionId;
                }
                // Собираем остальные параметры
                Object.keys(allParams).forEach(key => {
                    if (key !== 'screen' && key !== 'services' && key !== 'service') {
                        params[key] = allParams[key];
                    }
                });
                return { screen, params };
            }

            // 3. Подарок (gift)
            if (hasKey('gift')) {
                screen = 'subscription';
                params.action = 'gift';
                if (allParams.service_id || allParams.serviceId) {
                    params.service_id = allParams.service_id || allParams.serviceId;
                }
                // Собираем остальные параметры
                Object.keys(allParams).forEach(key => {
                    if (key !== 'screen' && key !== 'gift') {
                        params[key] = allParams[key];
                    }
                });
                return { screen, params };
            }

            // 4. Ежедневный бонус (daily-bonus)
            if (hasKey('daily-bonus') || hasKey('daily_bonus') || hasKey('bonus')) {
                screen = 'subscription';
                params.action = 'daily-bonus';
                // Собираем остальные параметры
                Object.keys(allParams).forEach(key => {
                    if (key !== 'screen' && key !== 'daily-bonus' && key !== 'daily_bonus' && key !== 'bonus') {
                        params[key] = allParams[key];
                    }
                });
                return { screen, params };
            }

            // 5. Новости (news)
            if (hasKey('news')) {
                screen = 'subscription';
                params.action = 'news';
                // Собираем остальные параметры
                Object.keys(allParams).forEach(key => {
                    if (key !== 'screen' && key !== 'news') {
                        params[key] = allParams[key];
                    }
                });
                return { screen, params };
            }

            // Проверяем screen параметр
            if (allParams.screen && this.screens[allParams.screen]) {
                screen = allParams.screen;
            }

            // Проверяем прямой hash: #keys
            if (!screen && window.location.hash) {
                const hash = window.location.hash.substring(1).split('?')[0]; // Берем только часть до ?
                if (hash && this.screens[hash]) {
                    screen = hash;
                }
            }

            // Если есть параметр activate без screen, открываем инструкции
            if (!screen && (allParams.activate || allParams.code)) {
                screen = 'instructions';
            }

            // ✅ Обработка action параметра для существующих экранов
            if (screen && allParams.action) {
                params.action = allParams.action;
                
                // Специфичные параметры для разных действий
                if (allParams.subscription_id || allParams.subscriptionId) {
                    params.subscription_id = allParams.subscription_id || allParams.subscriptionId;
                }
                if (allParams.service_id || allParams.serviceId) {
                    params.service_id = allParams.service_id || allParams.serviceId;
                }
                if (allParams.faq) {
                    params.faq = allParams.faq;
                }
                if (allParams.code) {
                    params.code = allParams.code;
                }
            }

            // Собираем все остальные параметры
            Object.keys(allParams).forEach(key => {
                if (key !== 'screen' && !params[key]) {
                    params[key] = allParams[key];
                }
            });

            const result = screen ? { screen, params } : null;
            if (result) {
                console.log('[Deep Link] Result:', result);
            }
            return result;
        } catch (error) {
            return null;
        }
    },

    /**
     * Восстановление состояния роутера
     */
    async restoreState() {
        try {
            // ✅ Сначала проверяем deep link из URL (приоритет выше сохраненного состояния)
            const deepLink = this.parseDeepLink();
            console.log('[Deep Link] restoreState - deepLink:', deepLink);
            if (deepLink) {
                console.log('[Deep Link] Setting screen to:', deepLink.screen, 'with params:', deepLink.params);
                this.currentScreen = deepLink.screen;
                this.previousScreen = null;
                this.history = [];
                // Сохраняем параметры для передачи в navigate
                this.deepLinkParams = deepLink.params;
                return;
            }

            let state;

            if (window.Storage) {
                state = await window.Storage.get('router_state');
            } else {
                const saved = localStorage.getItem('dragon_vpn_router_state');
                state = saved ? JSON.parse(saved) : null;
            }

            if (state) {
                this.currentScreen = state.currentScreen || 'subscription';
                this.previousScreen = state.previousScreen || null;
                this.history = state.history || [];

            }
        } catch (error) {
            this.currentScreen = 'subscription';
            this.previousScreen = null;
            this.history = [];
        }
    },

    /**
     * Очистка истории
     */
    clearHistory() {
        this.history = [];
        this.saveState();
        this.updateTelegramBackButton();
    },

    /**
     * Замена текущего экрана (без добавления в историю)
     */
    async replace(screenName, params = {}) {
        await this.navigate(screenName, false, params);
    },

    /**
     * Навигация с очисткой истории
     */
    async reset(screenName, params = {}) {
        this.clearHistory();
        await this.replace(screenName, params);
    },

    /**
     * Проверка активности экрана
     */
    isScreenActive(screenName) {
        return this.currentScreen === screenName;
    },

};