let _navigationDebounce = null;

window.Navigation = {
    currentScreen: 'subscription',
    badges: new Map(),
    isInitialized: false,

    /**
     * Инициализация навигации
     */
    init() {
        if (this.isInitialized) {
            Utils.log('warn', 'Navigation already initialized');
            return;
        }

        this.setupEventListeners();
        this.updateActiveState();
        this.isInitialized = true;
    },

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (!navItem) return;

            const screen = navItem.dataset.screen;
            if (screen && screen !== this.currentScreen) {
                this.navigateTo(screen);
            }
        });
    },

    /**
     * Навигация к экрану
     */
    async navigateTo(screen) {
        if (!this.isValidScreen(screen)) {
            Utils.log('error', `Invalid screen: ${screen}`);
            return;
        }

        // ✅ Защита от множественных переходов
        if (this.isNavigating || screen === this.currentScreen) return;
        this.isNavigating = true;

        try {
            // ✅ Анимация и вибрация ОДИН раз
            this.animateNavItem(screen);

            if (window.TelegramApp && !this._lastVibration ||
                Date.now() - this._lastVibration > 300) {
                window.TelegramApp.haptic.selection();
                this._lastVibration = Date.now();
            }

            // ✅ Навигация только через роутер
            if (window.Router) {
                await window.Router.navigate(screen);
            }


        } catch (error) {
            Utils.log('error', 'Navigation failed:', error);
            if (window.Toast) {
                window.Toast.error('Ошибка навигации');
            }
        } finally {
            // Снимаем блокировку сразу после перехода
            this.isNavigating = false;
        }
    },

    /**
     * Анимация элемента навигации при нажатии
     */
    animateNavItem(screen) {
        const navItem = document.querySelector(`[data-screen="${screen}"]`);
        if (!navItem) return;

        // Убираем анимацию для мгновенного отклика
        navItem.style.transform = 'scale(1)';
    },

    /**
     * Обновление активного состояния
     */
    updateActiveState(screen = null) {
        const targetScreen = screen || (window.Router ? window.Router.getCurrentScreen() : this.currentScreen);
        this.currentScreen = targetScreen;

        // Обновляем все элементы навигации
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const itemScreen = item.dataset.screen;
            const isActive = itemScreen === targetScreen;

            item.classList.toggle('active', isActive);

            // Убираем анимацию для мгновенного отклика
            if (isActive) {
                const icon = item.querySelector('.nav-icon');
                if (icon) {
                    icon.style.transform = 'scale(1)';
                }
            }
        });
    },

    /**
     * Проверка валидности экрана
     */
    isValidScreen(screen) {
        const validScreens = ['subscription', 'keys', 'referrals', 'payments', 'instructions', 'support'];
        return validScreens.includes(screen);
    },

    /**
     * Установка бейджа на элемент навигации
     */
    setBadge(screen, count) {
        this.badges.set(screen, count);
        this.updateBadgeDisplay(screen, count);
    },

    /**
     * Удаление бейджа
     */
    clearBadge(screen) {
        this.badges.delete(screen);
        this.updateBadgeDisplay(screen, 0);
    },

    /**
     * Обновление отображения бейджа
     */
    updateBadgeDisplay(screen, count) {
        const navItem = document.querySelector(`[data-screen="${screen}"]`);
        if (!navItem) return;

        let badge = navItem.querySelector('.nav-badge');

        if (count > 0) {
            if (!badge) {
                badge = Utils.createElement('div', {
                    className: 'nav-badge'
                });
                navItem.appendChild(badge);
            }

            badge.textContent = count > 99 ? '99+' : count.toString();
            badge.classList.remove('hidden');

            // Анимация появления
            badge.style.transform = 'scale(0)';
            setTimeout(() => {
                badge.style.transform = 'scale(1)';
            }, 100);

        } else if (badge) {
            badge.classList.add('hidden');
            setTimeout(() => {
                if (badge.parentNode) {
                    badge.parentNode.removeChild(badge);
                }
            }, 300);
        }
    },

    /**
     * Получение текущего экрана
     */
    getCurrentScreen() {
        return this.currentScreen;
    },

    /**
     * Проверка активности экрана
     */
    isScreenActive(screen) {
        return this.currentScreen === screen;
    },

    /**
     * Установка индикатора уведомлений
     */
    setNotificationIndicator(screen, hasNotifications = true) {
        const navItem = document.querySelector(`[data-screen="${screen}"]`);
        if (!navItem) return;

        const icon = navItem.querySelector('.nav-icon');
        if (!icon) return;

        if (hasNotifications) {
            icon.classList.add('has-notification');

            // Добавляем пульсацию
            icon.style.animation = 'pulse 1.5s infinite';
        } else {
            icon.classList.remove('has-notification');
            icon.style.animation = '';
        }
    },

    /**
     * Обновление состояния элементов навигации на основе данных приложения
     */
    async updateNavigationState() {
        try {
            // Проверяем pending платежи
            await this.checkPendingPayments();

            // Проверяем новые рефералы
            await this.checkNewReferrals();

            // Проверяем уведомления о подписках
            await this.checkSubscriptionNotifications();

        } catch (error) {
            Utils.log('error', 'Failed to update navigation state:', error);
        }
    },

    /**
     * Проверка pending платежей
     */
    async checkPendingPayments() {
        try {
            const pendingPayments = await window.Storage?.getPendingPayments() || [];
            this.setBadge('payments', pendingPayments.length);

            if (pendingPayments.length > 0) {
                this.setNotificationIndicator('payments', true);
            } else {
                this.setNotificationIndicator('payments', false);
            }
        } catch (error) {
            Utils.log('error', 'Failed to check pending payments:', error);
        }
    },

    /**
     * Проверка новых рефералов
     */
    async checkNewReferrals() {
        try {
            const referralData = await window.Storage?.getReferralData() || { referrals: [] };
            const newReferrals = referralData.referrals.filter(r => r.is_new);

            if (newReferrals.length > 0) {
                this.setBadge('referrals', newReferrals.length);
                this.setNotificationIndicator('referrals', true);
            } else {
                this.clearBadge('referrals');
                this.setNotificationIndicator('referrals', false);
            }
        } catch (error) {
            Utils.log('error', 'Failed to check new referrals:', error);
        }
    },

    /**
     * Проверка уведомлений о подписках
     */
    async checkSubscriptionNotifications() {
        try {
            const subscriptions = await window.Storage?.getSubscriptions() || [];
            const expiringSoon = subscriptions.filter(s => {
                const daysLeft = Utils.daysBetween(s.expires_at);
                return daysLeft <= 7 && daysLeft > 0 && s.status === 'active';
            });

            if (expiringSoon.length > 0) {
                this.setNotificationIndicator('subscription', true);
            } else {
                this.setNotificationIndicator('subscription', false);
            }
        } catch (error) {
            Utils.log('error', 'Failed to check subscription notifications:', error);
        }
    },

    /**
     * Скрытие/показ навигации
     */
    hide() {
        const nav = document.querySelector('.bottom-nav');
        if (nav) {
            nav.style.transform = 'translateY(100%)';
        }
    },

    show() {
        const nav = document.querySelector('.bottom-nav');
        if (nav) {
            nav.style.transform = 'translateY(0)';
        }
    },




    /**
     * Анимация при получении уведомления
     */
    animateNotification(screen) {
        const navItem = document.querySelector(`[data-screen="${screen}"]`);
        if (!navItem) return;

        // Добавляем класс анимации
        navItem.classList.add('notification-pulse');

        // Убираем через некоторое время
        setTimeout(() => {
            navItem.classList.remove('notification-pulse');
        }, 1000);

        // Вибрация
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }
    },

    /**
     * Обработка событий приложения для обновления навигации
     */
    handleAppEvents() {
        // Новый платеж
        document.addEventListener('paymentCreated', () => {
            this.updateNavigationState();
        });

        // Новый реферал
        document.addEventListener('referralAdded', () => {
            this.animateNotification('referrals');
            this.updateNavigationState();
        });

        // Изменение подписки
        document.addEventListener('subscriptionChanged', () => {
            this.updateNavigationState();
        });

        // Обновление данных
        document.addEventListener('dataRefreshed', () => {
            this.updateNavigationState();
        });
    },

    /**
     * Очистка навигации
     */
    cleanup() {
        this.badges.clear();
        this.currentScreen = 'subscription';
        this.isInitialized = false;
    }
};