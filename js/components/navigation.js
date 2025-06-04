// Navigation Component for Dragon VPN Mini App

window.Navigation = {
    currentScreen: 'subscription',
    badges: new Map(),
    isInitialized: false,

    /**
     * Инициализация навигации
     */
    init() {
        this.setupEventListeners();
        this.updateActiveState();
        this.isInitialized = true;
        Utils.log('info', 'Navigation initialized');
    },

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Обработка кликов по элементам навигации
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (!navItem) return;

            const screen = navItem.dataset.screen;
            if (screen && screen !== this.currentScreen) {
                this.navigateTo(screen);
            }
        });

        // Слушаем изменения роутера
        document.addEventListener('routeChanged', (e) => {
            this.updateActiveState(e.detail.screen);
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

        try {
            // Анимация нажатия
            this.animateNavItem(screen);

            // Вибрация
            if (window.TelegramApp) {
                window.TelegramApp.haptic.selection();
            }

            // Навигация через роутер
            if (window.Router) {
                await window.Router.navigate(screen);
            }

            // Обновляем состояние
            this.updateActiveState(screen);

            Utils.log('info', `Navigation: ${this.currentScreen} -> ${screen}`);

        } catch (error) {
            Utils.log('error', 'Navigation failed:', error);

            if (window.Toast) {
                window.Toast.error('Ошибка навигации');
            }
        }
    },

    /**
     * Анимация элемента навигации при нажатии
     */
    animateNavItem(screen) {
        const navItem = document.querySelector(`[data-screen="${screen}"]`);
        if (!navItem) return;

        navItem.style.transform = 'scale(0.95)';
        setTimeout(() => {
            navItem.style.transform = 'scale(1)';
        }, 150);
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

            // Анимация иконки при активации
            if (isActive) {
                const icon = item.querySelector('.nav-icon');
                if (icon) {
                    icon.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        icon.style.transform = 'scale(1)';
                    }, 200);
                }
            }
        });
    },

    /**
     * Проверка валидности экрана
     */
    isValidScreen(screen) {
        const validScreens = ['subscription', 'keys', 'referrals', 'payments'];
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
     * Временное скрытие навигации (например, для полноэкранного контента)
     */
    hideTemporarily(duration = 3000) {
        this.hide();
        setTimeout(() => {
            this.show();
        }, duration);
    },

    /**
     * Добавление кастомного элемента навигации
     */
    addCustomNavItem(config) {
        const navGrid = document.querySelector('.nav-grid');
        if (!navGrid) return;

        const navItem = Utils.createElement('div', {
            className: 'nav-item',
            dataset: { screen: config.screen }
        }, `
            <i class="${config.icon} nav-icon"></i>
            <span class="nav-label">${config.label}</span>
        `);

        // Вставляем в нужную позицию
        if (config.position !== undefined) {
            const existingItems = navGrid.children;
            if (config.position < existingItems.length) {
                navGrid.insertBefore(navItem, existingItems[config.position]);
            } else {
                navGrid.appendChild(navItem);
            }
        } else {
            navGrid.appendChild(navItem);
        }

        // Добавляем обработчик
        navItem.addEventListener('click', () => {
            if (typeof config.handler === 'function') {
                config.handler();
            } else {
                this.navigateTo(config.screen);
            }
        });

        return navItem;
    },

    /**
     * Удаление элемента навигации
     */
    removeNavItem(screen) {
        const navItem = document.querySelector(`[data-screen="${screen}"]`);
        if (navItem && navItem.parentNode) {
            navItem.parentNode.removeChild(navItem);
        }
    },

    /**
     * Получение статистики навигации
     */
    getNavigationStats() {
        const navItems = document.querySelectorAll('.nav-item');
        const stats = {
            totalItems: navItems.length,
            activeItem: this.currentScreen,
            badges: Object.fromEntries(this.badges),
            items: []
        };

        navItems.forEach(item => {
            const screen = item.dataset.screen;
            const isActive = item.classList.contains('active');
            const hasNotification = item.querySelector('.nav-icon')?.classList.contains('has-notification');
            const badgeCount = this.badges.get(screen) || 0;

            stats.items.push({
                screen,
                isActive,
                hasNotification,
                badgeCount
            });
        });

        return stats;
    },

    /**
     * Сброс всех уведомлений
     */
    clearAllNotifications() {
        this.badges.clear();

        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const screen = item.dataset.screen;
            this.clearBadge(screen);
            this.setNotificationIndicator(screen, false);
        });
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