// Router for Dragon VPN Mini App

window.Router = {
    currentScreen: 'subscription',
    previousScreen: null,
    history: [],
    maxHistoryLength: 10,
    isNavigating: false,

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
    init() {
        this.ensureExpanded();

        this.setupFullViewport();
        this.setupTelegramBackButton();
        this.setupNavigationEvents();
        this.restoreState();
        this.navigate(this.currentScreen, false);
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

            // Обновляем навигацию
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
                // Не вызываем refresh чтобы избежать двойного рендеринга
                // Данные обновятся при следующем явном обновлении
                return; // Показываем экран сразу
            }

            // Только для первого раза делаем полную инициализацию
            if (typeof handler.init === 'function') {
                await handler.init(params);
            }
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
     * Восстановление состояния роутера
     */
    async restoreState() {
        try {
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

    /**
     * Получение параметров экрана
     */
    getScreenParams(screenName) {
        // В будущем можно добавить систему параметров
        return {};
    },

    /**
     * Предзагрузка экрана
     */
    async preloadScreen(screenName) {
        const handler = this.screenHandlers[screenName]?.();

        if (handler && typeof handler.preload === 'function') {
            await handler.preload();
        }
    },

    /**
     * Получение статистики навигации
     */
    getNavigationStats() {
        return {
            currentScreen: this.currentScreen,
            previousScreen: this.previousScreen,
            historyLength: this.history.length,
            history: [...this.history],
            canGoBack: this.canGoBack(),
            availableScreens: Object.keys(this.screens)
        };
    },

    /**
     * Обработка глубоких ссылок (deep links)
     */
    handleDeepLink(url) {
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname.replace('/', '');
            const params = Object.fromEntries(urlObj.searchParams);

            if (this.screens[path]) {
                this.navigate(path, true, params);
                return true;
            }

            return false;
        } catch (error) {
            return false;
        }
    },

    /**
     * Генерация ссылки на экран
     */
    generateLink(screenName, params = {}) {
        if (!this.screens[screenName]) return null;

        const url = new URL(window.location.href);
        url.pathname = `/${screenName}`;

        // Добавляем параметры
        Object.keys(params).forEach(key => {
            url.searchParams.set(key, params[key]);
        });

        return url.toString();
    }
};