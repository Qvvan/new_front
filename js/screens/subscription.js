// Subscription Screen for Dragon VPN Mini App

window.SubscriptionScreen = {
    currentSubscriptions: [], // Только в памяти
    servicesCache: new Map(), // Сессионный кеш услуг
    isLoaded: false,

    /**
     * Инициализация экрана подписки
     */
    async init() {
        Utils.log('info', 'Initializing Subscription Screen');

        await this.loadServices();
        await this.loadSubscriptions();

        this.render();
        this.setupEventListeners(); // ✅ Добавить эту строку
        this.isLoaded = true;
    },

    /**
     * Загрузка и кеширование услуг
     */
    async loadServices() {
        try {
            if (window.ServiceAPI) {
                const response = await window.ServiceAPI.getServices();
                const services = response.services || [];

                services.forEach(service => {
                    this.servicesCache.set(service.id, service);
                });

                Utils.log('info', `Cached ${services.length} services`);
            }
        } catch (error) {
            Utils.log('error', 'Failed to load services for caching:', error);
        }
    },

    /**
     * Загрузка подписок пользователя с API
     */
    async loadSubscriptions() {
        try {
            const response = await window.SubscriptionAPI.listSubscriptions();
            this.currentSubscriptions = response.subscriptions || [];

            if (window.Storage) {
                window.Storage.setSubscriptions(this.currentSubscriptions);
            }

            Utils.log('info', `Loaded ${this.currentSubscriptions.length} subscriptions`);

        } catch (error) {
            Utils.log('error', 'Failed to load subscriptions:', error);

            if (window.Storage) {
                this.currentSubscriptions = await window.Storage.getSubscriptions();
            }

            if (this.currentSubscriptions.length === 0) {
                this.isEmpty = true;
                if (window.Toast) {
                    window.Toast.error('Ошибка загрузки подписок');
                }
            }
        }
    },

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const subscriptionScreen = e.target.closest('#subscriptionScreen');
            if (!subscriptionScreen) return;

            const target = e.target.closest('[data-action]');
            if (!target) return;

            if (target.hasAttribute('data-processing')) return;
            target.setAttribute('data-processing', 'true');
            setTimeout(() => target.removeAttribute('data-processing'), 300);

            const action = target.dataset.action;
            const subscriptionId = target.dataset.subscriptionId;

            this.handleAction(action, subscriptionId);
        });

        document.addEventListener('click', (e) => {
            const subscriptionScreen = e.target.closest('#subscriptionScreen');
            if (!subscriptionScreen) return;

            const autoRenewal = e.target.closest('.auto-renewal');
            if (!autoRenewal) return;

            if (autoRenewal.hasAttribute('data-processing')) return;
            autoRenewal.setAttribute('data-processing', 'true');
            setTimeout(() => autoRenewal.removeAttribute('data-processing'), 300);

            const subscriptionId = autoRenewal.dataset.subscriptionId;
            this.handleAutoRenewalToggle(subscriptionId);
        });

        document.addEventListener('click', (e) => {
            const subscriptionScreen = e.target.closest('#subscriptionScreen');
            if (!subscriptionScreen) return;

            const compactAutoRenewal = e.target.closest('.subscription-compact-auto-renewal');
            if (!compactAutoRenewal) return;

            if (compactAutoRenewal.hasAttribute('data-processing')) return;
            compactAutoRenewal.setAttribute('data-processing', 'true');
            setTimeout(() => compactAutoRenewal.removeAttribute('data-processing'), 300);

            const subscriptionId = compactAutoRenewal.dataset.subscriptionId;
            this.handleAutoRenewalToggle(subscriptionId);
        });
    },

    /**
     * Обработка действий
     */
    async handleAction(action, subscriptionId = null) {
        if (this.isProcessingAction) return;
        this.isProcessingAction = true;

        try {
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
        } finally {
            setTimeout(() => {
                this.isProcessingAction = false;
            }, 500);
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

            const confirmed = await window.TelegramApp.showConfirm(
                'Активировать пробный период на 7 дней бесплатно?'
            );

            if (!confirmed) return;

            const response = await window.SubscriptionAPI.activateTrial();

            if (window.Loading) {
                window.Loading.hide();
            }

            await this.showTrialActivationAnimation();

            await this.refresh();

            setTimeout(() => {
                this.handleViewInstructions();
            }, 1000);

        } catch (error) {
            Utils.log('error', 'Failed to activate trial:', error);

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

        const confirmed = await this.showAutoRenewalConfirmation(newAutoRenewal);
        if (!confirmed) return;

        try {
            await window.SubscriptionAPI.updateAutoRenewal(subscriptionId);

            subscription.auto_renewal = newAutoRenewal;

            this.updateAutoRenewalUI(subscriptionId, newAutoRenewal);

            if (window.Toast) {
                const message = newAutoRenewal
                    ? 'Автопродление включено'
                    : 'Автопродление отключено';
                window.Toast.success(message);
            }

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

        container.style.opacity = '0';
        container.style.transform = 'translateY(10px)';

        let content = '';
        if (this.isEmpty) {
            content = this.renderEmptyState();
        } else if (this.currentSubscriptions.length === 1) {
            content = this.renderSingleSubscription(this.currentSubscriptions[0]);
        } else {
            content = this.renderMultipleSubscriptions();
        }

        content += this.renderQuickActions();

        container.innerHTML = Utils.wrapContent(content);

        requestAnimationFrame(() => {
            container.style.transition = 'all 0.2s ease-out';
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        });
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
        const isTrial = this.isTrialSubscription(subscription);

        const statusClass = isExpired ? 'expired' : 'active';
        const statusText = isExpired ? 'Истекла' : 'Активна';

        const renewalDate = Utils.formatDate(subscription.end_date);
        const autoRenewalText = subscription.auto_renewal && !isExpired
            ? `Продление ${renewalDate}`
            : `Завершится ${renewalDate}`;

        const serviceName = this.getServiceName(subscription);

        return `
            <div class="card subscription-card" data-subscription-id="${subscription.id}">
                <div class="subscription-header">
                    <h2 class="subscription-title">
                        <i class="fas ${isTrial ? 'fa-gift' : 'fa-shield-alt'}"></i>
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

                ${!isExpired && !isTrial ? `
                    <div class="auto-renewal" data-subscription-id="${subscription.id}">
                        <div class="auto-renewal-info">
                            <div class="auto-renewal-icon">
                                <img src="${window.Assets.getGif('auto-renewal.gif')}" alt="Auto renewal" class="auto-renewal-gif" />
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
            const isTrial = this.isTrialSubscription(subscription);

            const statusClass = isExpired ? 'expired' : 'active';
            const statusText = isExpired ? 'Истекла' : 'Активна';

            const serviceName = this.getServiceName(subscription);

            content += `
                <div class="subscription-compact ${statusClass}" data-subscription-id="${subscription.id}">
                    <div class="subscription-compact-info">
                        <div class="subscription-compact-icon">
                            <i class="fas ${isTrial ? 'fa-gift' : 'fa-shield-alt'}"></i>
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
                        ${!isTrial && !isExpired ? `
                            <div class="subscription-compact-auto-renewal"
                                 data-subscription-id="${subscription.id}"
                                 title="Автопродление">
                                <div class="toggle-switch-compact ${subscription.auto_renewal ? 'active' : ''}">
                                    <div class="toggle-slider-compact"></div>
                                </div>
                            </div>
                        ` : ''}
                        <button class="btn btn-sm btn-primary" data-action="renew" data-subscription-id="${subscription.id}">
                            <i class="fas fa-credit-card"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        content += '</div>';

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
                    <img src="${window.Assets.getGif('management.gif')}" alt="Management" class="section-title-gif" />
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
        if (this.isTrialSubscription(subscription)) {
            return 'Пробный период';
        }

        const service = this.servicesCache.get(subscription.service_id);
        if (service) {
            return service.name;
        }

        return `Подписка ${subscription.service_id.slice(0, 8)}`;
    },

        /**
     * Проверка на пробный период
     */
    isTrialSubscription(subscription) {
        const TRIAL_SERVICE_UUID = "00000000-0000-0000-0000-000000000000";
        return subscription.service_id === TRIAL_SERVICE_UUID;
    },

        /**
     * Определение типа подписки для отображения
     */
    getSubscriptionType(subscription) {
        if (this.isTrialSubscription(subscription)) {
            return 'trial';
        }

        const daysLeft = Utils.daysBetween(subscription.end_date);
        if (daysLeft <= 0) {
            return 'expired';
        }

        return 'active';
    },

    /**
     * Обновление UI автопродления
     */
    updateAutoRenewalUI(subscriptionId, autoRenewal) {
        // Обновляем полный формат
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

        const compactToggle = document.querySelector(`[data-subscription-id="${subscriptionId}"] .toggle-switch-compact`);
        if (compactToggle) {
            compactToggle.classList.toggle('active', autoRenewal);
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

            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

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
        this.servicesCache.clear();
        await this.loadServices();
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