// Subscription Screen for Dragon VPN Mini App

window.SubscriptionScreen = {
    currentSubscriptions: [],
    isLoaded: false,

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
     * Загрузка подписок пользователя
     */
    async loadSubscriptions() {
        try {
            if (window.Loading) {
                window.Loading.show();
            }

            // Загружаем подписки через API
            if (window.SubscriptionAPI) {
                const response = await window.SubscriptionAPI.listSubscriptions();
                this.currentSubscriptions = response.subscriptions || [];
            } else {
                // Fallback данные для разработки
                this.currentSubscriptions = [
                    {
                        id: '1',
                        service_name: 'Премиум 6 месяцев',
                        status: 'active',
                        expires_at: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
                        auto_renewal: true,
                        price: 2399,
                        created_at: new Date().toISOString()
                    }
                ];
            }

            Utils.log('info', 'Subscriptions loaded:', this.currentSubscriptions);

        } catch (error) {
            Utils.log('error', 'Failed to load subscriptions:', error);
            if (window.Toast) {
                window.Toast.show('Ошибка загрузки подписок', 'error');
            }
            this.currentSubscriptions = [];
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
        // Обработчик для кнопок действий
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
            if (!e.target.closest('.auto-renewal')) return;

            const subscriptionId = e.target.closest('.auto-renewal').dataset.subscriptionId;
            this.handleAutoRenewalToggle(subscriptionId);
        });
    },

    /**
     * Обработка действий
     */
    async handleAction(action, subscriptionId = null) {
        // Добавляем вибрацию
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
            let result;
            if (window.SubscriptionAPI) {
                result = await window.SubscriptionAPI.activateTrial();
            } else {
                // Симуляция для разработки
                await new Promise(resolve => setTimeout(resolve, 2000));
                result = {
                    subscription: {
                        id: '2',
                        service_name: 'Пробный период',
                        status: 'active',
                        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        auto_renewal: false,
                        price: 0,
                        is_trial: true
                    }
                };
            }

            if (window.Loading) {
                window.Loading.hide();
            }

            // Показываем анимацию успеха
            await this.showTrialActivationAnimation();

            // Обновляем данные
            this.currentSubscriptions.push(result.subscription);
            this.render();

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
                window.Toast.show('Ошибка активации пробного периода', 'error');
            }
        }
    },

    /**
     * Анимация активации пробного периода
     */
    async showTrialActivationAnimation() {
        return new Promise((resolve) => {
            // Создаем элемент анимации
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
     * Переключение автопродления
     */
    async handleAutoRenewalToggle(subscriptionId) {
        const subscription = this.currentSubscriptions.find(s => s.id === subscriptionId);
        if (!subscription) return;

        const newAutoRenewal = !subscription.auto_renewal;
        const action = newAutoRenewal ? 'включить' : 'выключить';

        // Показываем подтверждение с объяснением
        const confirmed = await this.showAutoRenewalConfirmation(newAutoRenewal);
        if (!confirmed) return;

        try {
            if (window.Loading) {
                window.Loading.show();
            }

            // Обновляем через API
            if (window.SubscriptionAPI) {
                await window.SubscriptionAPI.updateSubscription(subscriptionId, {
                    auto_renewal: newAutoRenewal
                });
            }

            // Обновляем локальные данные
            subscription.auto_renewal = newAutoRenewal;

            // Обновляем UI
            this.updateAutoRenewalUI(subscriptionId, newAutoRenewal);

            if (window.Toast) {
                const message = newAutoRenewal
                    ? 'Автопродление включено'
                    : 'Автопродление отключено';
                window.Toast.show(message, 'success');
            }

            // Вибрация
            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

        } catch (error) {
            Utils.log('error', 'Failed to update auto renewal:', error);

            if (window.Toast) {
                window.Toast.show('Ошибка изменения автопродления', 'error');
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
                const renewalDate = Utils.formatDate(subscription.expires_at);
                statusText.textContent = autoRenewal
                    ? `Продление ${renewalDate}`
                    : `Завершится ${renewalDate}`;
            }
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

        const hasSubscriptions = this.currentSubscriptions.length > 0;
        const activeSubscriptions = this.currentSubscriptions.filter(s =>
            s.status === 'active' || s.status === 'trial'
        );

        let content;

        if (!hasSubscriptions) {
            // Нет подписок - показываем пустое состояние
            content = this.renderEmptyState();
        } else if (activeSubscriptions.length === 1) {
            // Одна подписка - полный формат
            content = this.renderSingleSubscription(activeSubscriptions[0]);
        } else {
            // Несколько подписок - компактный формат
            content = this.renderMultipleSubscriptions();
        }

        container.innerHTML = content + this.renderQuickActions();
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
     * Рендеринг одной подписки
     */
    renderSingleSubscription(subscription) {
        const daysLeft = Utils.daysBetween(subscription.expires_at);
        const isExpired = daysLeft <= 0;
        const statusClass = isExpired ? 'expired' : (subscription.is_trial ? 'trial' : 'active');
        const statusText = isExpired ? 'Истекла' : (subscription.is_trial ? 'Пробная' : 'Активна');

        const renewalDate = Utils.formatDate(subscription.expires_at);
        const autoRenewalText = subscription.auto_renewal
            ? `Продление ${renewalDate}`
            : `Завершится ${renewalDate}`;

        return `
            <div class="card subscription-card" data-subscription-id="${subscription.id}">
                <div class="subscription-header">
                    <h2 class="subscription-title">
                        <i class="fas fa-shield-alt"></i>
                        ${subscription.service_name}
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

                ${!isExpired ? `
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
     * Рендеринг нескольких подписок
     */
    renderMultipleSubscriptions() {
        let content = '<div class="subscriptions-compact">';

        this.currentSubscriptions.forEach(subscription => {
            const daysLeft = Utils.daysBetween(subscription.expires_at);
            const isExpired = daysLeft <= 0;
            const statusClass = isExpired ? 'expired' : 'active';

            content += `
                <div class="subscription-compact ${statusClass}" data-subscription-id="${subscription.id}">
                    <div class="subscription-compact-info">
                        <div class="subscription-compact-icon">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div class="subscription-compact-details">
                            <h4>${subscription.service_name}</h4>
                            <p>${isExpired ? 'Истекла' : (subscription.is_trial ? 'Пробная' : 'Активна')}</p>
                        </div>
                    </div>
                    <div class="subscription-compact-status">
                        <div class="subscription-compact-days ${isExpired ? 'text-red' : ''}">${Math.abs(daysLeft)}</div>
                        <div class="subscription-compact-label">
                            ${isExpired ? 'дн. назад' : 'дн. осталось'}
                        </div>
                    </div>
                </div>
            `;
        });

        content += '</div>';

        // Добавляем кнопки действий для множественных подписок
        content += `
            <div class="subscription-actions">
                <button class="btn btn-primary" data-action="buy">
                    <i class="fas fa-plus"></i>
                    Новая подписка
                </button>
                <button class="btn btn-secondary" data-action="renew">
                    <i class="fas fa-credit-card"></i>
                    Продлить любую
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
     * Обновление данных подписки
     */
    async refresh() {
        await this.loadSubscriptions();
        this.render();
    },

    /**
     * Получение активных подписок
     */
    getActiveSubscriptions() {
        return this.currentSubscriptions.filter(s => {
            const daysLeft = Utils.daysBetween(s.expires_at);
            return daysLeft > 0 && (s.status === 'active' || s.status === 'trial');
        });
    },

    /**
     * Проверка наличия активных подписок
     */
    hasActiveSubscriptions() {
        return this.getActiveSubscriptions().length > 0;
    },

    /**
     * Получение подписки по ID
     */
    getSubscriptionById(id) {
        return this.currentSubscriptions.find(s => s.id === id);
    },

    /**
     * Добавление новой подписки
     */
    addSubscription(subscription) {
        this.currentSubscriptions.push(subscription);
        this.render();
    },

    /**
     * Обновление подписки
     */
    updateSubscription(id, updates) {
        const subscription = this.getSubscriptionById(id);
        if (subscription) {
            Object.assign(subscription, updates);
            this.render();
        }
    },

    /**
     * Удаление подписки
     */
    removeSubscription(id) {
        const index = this.currentSubscriptions.findIndex(s => s.id === id);
        if (index !== -1) {
            this.currentSubscriptions.splice(index, 1);
            this.render();
        }
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
     * Обработка события оплаты
     */
    handlePaymentSuccess(subscriptionData) {
        Utils.log('info', 'Payment success for subscription:', subscriptionData);

        // Добавляем или обновляем подписку
        const existingIndex = this.currentSubscriptions.findIndex(s => s.id === subscriptionData.id);
        if (existingIndex !== -1) {
            this.currentSubscriptions[existingIndex] = subscriptionData;
        } else {
            this.currentSubscriptions.push(subscriptionData);
        }

        this.render();
        this.animateElements();

        // Показываем уведомление
        if (window.Toast) {
            window.Toast.show('Подписка успешно оформлена!', 'success');
        }

        // Вибрация успеха
        if (window.TelegramApp) {
            window.TelegramApp.haptic.success();
        }
    },

    /**
     * Проверка истечения подписок
     */
    checkExpiredSubscriptions() {
        let hasExpiredSubscriptions = false;

        this.currentSubscriptions.forEach(subscription => {
            const daysLeft = Utils.daysBetween(subscription.expires_at);
            if (daysLeft <= 0 && subscription.status === 'active') {
                subscription.status = 'expired';
                hasExpiredSubscriptions = true;
            }
        });

        if (hasExpiredSubscriptions) {
            this.render();

            if (window.Toast) {
                window.Toast.show('Некоторые подписки истекли', 'warning');
            }
        }
    },

    /**
     * Получение статистики подписок
     */
    getSubscriptionStats() {
        const total = this.currentSubscriptions.length;
        const active = this.currentSubscriptions.filter(s => s.status === 'active').length;
        const expired = this.currentSubscriptions.filter(s => s.status === 'expired').length;
        const trial = this.currentSubscriptions.filter(s => s.is_trial).length;

        return { total, active, expired, trial };
    },

    /**
     * Экспорт данных подписок
     */
    exportSubscriptions() {
        const data = {
            subscriptions: this.currentSubscriptions,
            exported_at: new Date().toISOString(),
            user_id: window.TelegramApp.user?.id
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dragon-vpn-subscriptions-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    },

    /**
     * Очистка данных
     */
    cleanup() {
        this.currentSubscriptions = [];
        this.isLoaded = false;

        // Удаляем обработчики событий
        const container = document.getElementById('subscriptionScreen');
        if (container) {
            container.innerHTML = '';
        }
    }
};