// Subscription Screen for Dragon VPN Mini App

window.SubscriptionScreen = {
    currentSubscriptions: [],
    isLoaded: false,
    isEmpty: false,

    /**
     * Инициализация экрана подписки
     */
    async init() {
        Utils.log('info', 'Initializing Subscription Screen');
        await this.loadSubscriptions();
        this.setupEventListeners();
        this.render();
        this.isLoaded = true;
    },

    /**
     * Загрузка подписок пользователя с API
     */
    async loadSubscriptions() {
        try {
            if (window.Loading) {
                window.Loading.show('Загрузка подписок...');
            }

            // Получаем подписки через API
            const response = await window.SubscriptionAPI.listSubscriptions();
            this.currentSubscriptions = response.subscriptions || [];
            this.isEmpty = this.currentSubscriptions.length === 0;

            // Сортируем подписки: активные первыми, потом по дате создания
            this.currentSubscriptions.sort((a, b) => {
                if (a.status === 'active' && b.status !== 'active') return -1;
                if (a.status !== 'active' && b.status === 'active') return 1;
                return new Date(b.created_at) - new Date(a.created_at);
            });

            Utils.log('info', 'Subscriptions loaded:', this.currentSubscriptions);

        } catch (error) {
            Utils.log('error', 'Failed to load subscriptions:', error);
            this.isEmpty = true;
            this.currentSubscriptions = [];

            if (window.Toast) {
                window.Toast.error('Ошибка загрузки подписок');
            }
        } finally {
            if (window.Loading) {
                window.Loading.hide();
            }
        }
    },

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#subscriptionScreen')) return;

            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const subscriptionId = target.dataset.subscriptionId;

            this.handleAction(action, subscriptionId);
        });

        // Обработчик для автопродления
        document.addEventListener('click', (e) => {
            const autoRenewal = e.target.closest('.auto-renewal');
            if (!autoRenewal || !autoRenewal.closest('#subscriptionScreen')) return;

            const subscriptionId = autoRenewal.dataset.subscriptionId;
            this.handleAutoRenewalToggle(subscriptionId);
        });
    },

    /**
     * Обработка действий
     */
    async handleAction(action, subscriptionId = null) {
        // Вибрация
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }

        switch (action) {
            case 'renew':
                await this.handleRenewSubscription(subscriptionId);
                break;
            case 'buy':
                await this.handleBuyNewSubscription();
                break;
            case 'activate-trial':
                await this.handleActivateTrial();
                break;
            case 'instructions':
                this.handleViewInstructions();
                break;
            case 'support':
                this.handleContactSupport();
                break;
            default:
                Utils.log('warn', 'Unknown action:', action);
        }
    },

    /**
     * Продление подписки
     */
    async handleRenewSubscription(subscriptionId) {
        Utils.log('info', 'Renewing subscription:', subscriptionId);

        if (window.ServiceSelector) {
            await window.ServiceSelector.show('renew', subscriptionId);
        }
    },

    /**
     * Покупка новой подписки
     */
    async handleBuyNewSubscription() {
        Utils.log('info', 'Buying new subscription');

        if (window.ServiceSelector) {
            await window.ServiceSelector.show('buy');
        }
    },

    /**
     * Активация пробного периода
     */
    async handleActivateTrial() {
        try {
            Utils.log('info', 'Activating trial subscription');

            // Показываем подтверждение
            const confirmed = await window.TelegramApp.showConfirm(
                'Активировать пробный период на 7 дней бесплатно?'
            );

            if (!confirmed) return;

            if (window.Loading) {
                window.Loading.show('Активация пробного периода...');
            }

            // Активируем через API
            const response = await window.SubscriptionAPI.activateTrial();

            if (window.Loading) {
                window.Loading.hide();
            }

            // Показываем анимацию успеха
            await this.showTrialActivationAnimation();

            // Обновляем данные
            await this.refresh();

            // Показываем инструкции
            setTimeout(() => {
                this.handleViewInstructions();
            }, 1000);

        } catch (error) {
            Utils.log('error', 'Failed to activate trial:', error);

            if (window.Loading) {
                window.Loading.hide();
            }

            if (window.Toast) {
                const message = error.message || 'Ошибка активации пробного периода';
                window.Toast.error(message);
            }
        }
    },

    /**
     * Переключение автопродления
     */
    async handleAutoRenewalToggle(subscriptionId) {
        const subscription = this.currentSubscriptions.find(s => s.id === subscriptionId);
        if (!subscription) return;

        const newAutoRenewal = !subscription.auto_renewal;

        // Показываем подтверждение с объяснением
        const confirmed = await this.showAutoRenewalConfirmation(newAutoRenewal);
        if (!confirmed) return;

        try {
            if (window.Loading) {
                window.Loading.show('Обновление настроек...');
            }

            // Обновляем через API
            await window.SubscriptionAPI.updateAutoRenewal(subscriptionId);

            // Обновляем локальные данные
            subscription.auto_renewal = newAutoRenewal;

            // Обновляем UI
            this.updateAutoRenewalUI(subscriptionId, newAutoRenewal);

            if (window.Toast) {
                const message = newAutoRenewal
                    ? 'Автопродление включено'
                    : 'Автопродление отключено';
                window.Toast.success(message);
            }

            // Вибрация успеха
            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

        } catch (error) {
            Utils.log('error', 'Failed to update auto renewal:', error);

            if (window.Toast) {
                const message = error.message || 'Ошибка изменения автопродления';
                window.Toast.error(message);
            }
        } finally {
            if (window.Loading) {
                window.Loading.hide();
            }
        }
    },

    /**
     * Показ подтверждения автопродления
     */
    async showAutoRenewalConfirmation(enable) {
        const title = enable ? 'Включить автопродление?' : 'Выключить автопродление?';
        const message = enable
            ? 'При включении автопродления ваша подписка будет автоматически продлеваться за день до окончания действующего периода. Вы всегда можете отключить эту функцию.'
            : 'При отключении автопродления ваша подписка завершится в указанную дату. Вам потребуется продлить её вручную.';

        if (window.Modal) {
            return window.Modal.showConfirm(title, message);
        } else {
            return window.TelegramApp.showConfirm(`${title}\n\n${message}`);
        }
    },

    /**
     * Просмотр инструкций
     */
    handleViewInstructions() {
        if (window.Router) {
            window.Router.navigate('instructions');
        }
    },

    /**
     * Обращение в поддержку
     */
    handleContactSupport() {
        if (window.Router) {
            window.Router.navigate('support');
        }
    },

    /**
     * Рендеринг экрана
     */
    render() {
        const container = document.getElementById('subscriptionScreen');
        if (!container) return;

        let content = '';

        if (this.isEmpty) {
            // Нет подписок - показываем пустое состояние
            content = this.renderEmptyState();
        } else if (this.currentSubscriptions.length === 1) {
            // Одна подписка - полный формат
            content = this.renderSingleSubscription(this.currentSubscriptions[0]);
        } else {
            // Несколько подписок - компактный формат
            content = this.renderMultipleSubscriptions();
        }

        // Добавляем быстрые действия
        content += this.renderQuickActions();

        container.innerHTML = content;
        this.animateElements();
    },

    /**
     * Рендеринг пустого состояния
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <h3 class="empty-state-title">Нет активных подписок</h3>
                <p class="empty-state-text">
                    Оформите подписку или активируйте пробный период для доступа к VPN
                </p>
                <div class="empty-state-actions">
                    <button class="btn btn-primary btn-full mb-md" data-action="activate-trial">
                        <i class="fas fa-gift"></i>
                        Пробный период 7 дней
                    </button>
                    <button class="btn btn-secondary btn-full" data-action="buy">
                        <i class="fas fa-shopping-cart"></i>
                        Оформить подписку
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг одной подписки (полный формат)
     */
    renderSingleSubscription(subscription) {
        const daysLeft = Utils.daysBetween(subscription.end_date);
        const isExpired = daysLeft <= 0;
        const isActive = subscription.status === 'active' && !isExpired;
        const isTrial = subscription.status === 'trial' || subscription.service_type === 'trial';

        const statusClass = isExpired ? 'expired' : (isTrial ? 'trial' : 'active');
        const statusText = isExpired ? 'Истекла' : (isTrial ? 'Пробная' : 'Активна');

        const renewalDate = Utils.formatDate(subscription.end_date);
        const autoRenewalText = subscription.auto_renewal
            ? `Продление ${renewalDate}`
            : `Завершится ${renewalDate}`;

        const serviceName = this.getServiceName(subscription);

        return `
            <div class="card subscription-card" data-subscription-id="${subscription.id}">
                <div class="subscription-header">
                    <h2 class="subscription-title">
                        <i class="fas fa-shield-alt"></i>
                        ${serviceName}
                    </h2>
                    <div class="subscription-status ${statusClass}">${statusText}</div>
                </div>

                <div class="subscription-info">
                    <div class="time-remaining">
                        <div class="days-left ${isExpired ? 'text-red' : ''}">${Math.abs(daysLeft)}</div>
                        <div class="days-label">
                            ${isExpired ? 'дней назад истекла' : Utils.pluralize(daysLeft, ['день остался', 'дня осталось', 'дней осталось'])}
                        </div>
                    </div>
                </div>

                ${isActive && !isTrial ? `
                    <div class="auto-renewal" data-subscription-id="${subscription.id}">
                        <div class="auto-renewal-info">
                            <div class="auto-renewal-icon">
                                <i class="fas fa-sync-alt"></i>
                            </div>
                            <div class="auto-renewal-text">
                                <h4>Автопродление</h4>
                                <p class="auto-renewal-status">${autoRenewalText}</p>
                            </div>
                        </div>
                        <div class="toggle-switch ${subscription.auto_renewal ? 'active' : ''}">
                            <div class="toggle-slider"></div>
                        </div>
                    </div>
                ` : ''}

                <div class="subscription-actions">
                    <button class="btn btn-primary" data-action="renew" data-subscription-id="${subscription.id}">
                        <i class="fas fa-credit-card"></i>
                        ${isExpired ? 'Возобновить' : 'Продлить сейчас'}
                    </button>
                    <button class="btn btn-secondary" data-action="buy">
                        <i class="fas fa-plus"></i>
                        Новая подписка
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг нескольких подписок (компактный формат)
     */
    renderMultipleSubscriptions() {
        let content = '<div class="subscriptions-compact">';

        this.currentSubscriptions.forEach(subscription => {
            const daysLeft = Utils.daysBetween(subscription.end_date);
            const isExpired = daysLeft <= 0;
            const isTrial = subscription.status === 'trial' || subscription.service_type === 'trial';
            const statusClass = isExpired ? 'expired' : (isTrial ? 'trial' : 'active');
            const statusText = isExpired ? 'Истекла' : (isTrial ? 'Пробная' : 'Активна');
            const serviceName = this.getServiceName(subscription);

            content += `
                <div class="subscription-compact ${statusClass}" data-subscription-id="${subscription.id}">
                    <div class="subscription-compact-info">
                        <div class="subscription-compact-icon">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div class="subscription-compact-details">
                            <h4>${serviceName}</h4>
                            <p>${statusText}</p>
                        </div>
                    </div>
                    <div class="subscription-compact-status">
                        <div class="subscription-compact-days ${isExpired ? 'text-red' : ''}">${Math.abs(daysLeft)}</div>
                        <div class="subscription-compact-label">
                            ${isExpired ? 'дн. назад' : 'дн. осталось'}
                        </div>
                    </div>
                    <div class="subscription-compact-actions">
                        <button class="btn btn-sm btn-primary" data-action="renew" data-subscription-id="${subscription.id}">
                            <i class="fas fa-credit-card"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        content += '</div>';

        // Добавляем общие кнопки действий для множественных подписок
        content += `
            <div class="subscription-actions">
                <button class="btn btn-primary" data-action="buy">
                    <i class="fas fa-plus"></i>
                    Новая подписка
                </button>
            </div>
        `;

        return content;
    },

    /**
     * Рендеринг быстрых действий
     */
    renderQuickActions() {
        return `
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-bolt"></i>
                    Управление
                </h2>
                <div class="action-grid">
                    <div class="action-card" data-action="instructions">
                        <div class="action-icon">
                            <i class="fas fa-book"></i>
                        </div>
                        <div class="action-title">Инструкции</div>
                        <div class="action-subtitle">Как настроить VPN</div>
                    </div>

                    <div class="action-card" data-action="support">
                        <div class="action-icon">
                            <i class="fas fa-headset"></i>
                        </div>
                        <div class="action-title">Поддержка</div>
                        <div class="action-subtitle">Помощь 24/7</div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Получение имени сервиса
     */
    getServiceName(subscription) {
        // Пытаемся получить имя из service_id через кеш или API
        return subscription.service_name || `Подписка ${subscription.service_id.slice(0, 8)}`;
    },

    /**
     * Обновление UI автопродления
     */
    updateAutoRenewalUI(subscriptionId, autoRenewal) {
        const toggle = document.querySelector(`[data-subscription-id="${subscriptionId}"] .toggle-switch`);
        const statusText = document.querySelector(`[data-subscription-id="${subscriptionId}"] .auto-renewal-status`);

        if (toggle) {
            toggle.classList.toggle('active', autoRenewal);
        }

        if (statusText) {
            const subscription = this.currentSubscriptions.find(s => s.id === subscriptionId);
            if (subscription) {
                const renewalDate = Utils.formatDate(subscription.end_date);
                statusText.textContent = autoRenewal
                    ? `Продление ${renewalDate}`
                    : `Завершится ${renewalDate}`;
            }
        }
    },

    /**
     * Анимация активации пробного периода
     */
    async showTrialActivationAnimation() {
        return new Promise((resolve) => {
            const animationElement = Utils.createElement('div', {
                className: 'trial-activation'
            }, `
                <div class="trial-activation-content">
                    <div class="trial-activation-icon">
                        <i class="fas fa-gift"></i>
                    </div>
                    <h2 class="trial-activation-title">Пробный период активирован!</h2>
                    <p class="trial-activation-subtitle">Вы получили 7 дней бесплатного доступа</p>
                    <ul class="trial-activation-features">
                        <li>Безлимитный трафик</li>
                        <li>Все серверы доступны</li>
                        <li>Максимальная скорость</li>
                    </ul>
                </div>
            `);

            document.body.appendChild(animationElement);

            // Показываем анимацию
            setTimeout(() => {
                animationElement.classList.add('active');
            }, 100);

            // Вибрация успеха
            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

            // Скрываем через 4 секунды
            setTimeout(() => {
                animationElement.classList.remove('active');
                setTimeout(() => {
                    animationElement.remove();
                    resolve();
                }, 500);
            }, 4000);
        });
    },

    /**
     * Анимация появления элементов
     */
    animateElements() {
        const elements = document.querySelectorAll('#subscriptionScreen .card, #subscriptionScreen .action-card');
        elements.forEach((el, index) => {
            el.classList.add('stagger-item');
            el.style.animationDelay = `${index * 0.1}s`;
        });
    },

    /**
     * Обновление данных подписки
     */
    async refresh() {
        await this.loadSubscriptions();
        this.render();
    },

    /**
     * Проверка истечения подписок
     */
    checkExpiredSubscriptions() {
        let hasExpiredSubscriptions = false;

        this.currentSubscriptions.forEach(subscription => {
            const daysLeft = Utils.daysBetween(subscription.end_date);
            if (daysLeft <= 0 && subscription.status === 'active') {
                subscription.status = 'expired';
                hasExpiredSubscriptions = true;
            }
        });

        if (hasExpiredSubscriptions) {
            this.render();

            if (window.Toast) {
                window.Toast.warning('Некоторые подписки истекли');
            }
        }
    },

    /**
     * Получение активных подписок
     */
    getActiveSubscriptions() {
        return this.currentSubscriptions.filter(s => {
            const daysLeft = Utils.daysBetween(s.end_date);
            return daysLeft > 0 && (s.status === 'active' || s.status === 'trial');
        });
    },

    /**
     * Очистка данных
     */
    cleanup() {
        this.currentSubscriptions = [];
        this.isLoaded = false;
        this.isEmpty = false;

        const container = document.getElementById('subscriptionScreen');
        if (container) {
            container.innerHTML = '';
        }
    }
};