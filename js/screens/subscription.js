// Subscription Screen for Dragon VPN Mini App

window.SubscriptionScreen = {
    currentSubscriptions: [], // Только в памяти
    servicesCache: new Map(), // Сессионный кеш услуг
    isLoaded: false,

    /**
     * Инициализация экрана подписки
     */
    async init() {
        await this.loadUserData();
        await this.loadServices();
        await this.loadSubscriptions();

        this.render();
        this.setupEventListeners(); // ✅ Добавить эту строку
        this.isLoaded = true;
    },

    async loadUserData() {
        try {
            if (window.UserAPI) {
                const response = await window.UserAPI.getCurrentUser();
                this.userData = response.user || response;
            }
        } catch (error) {
            this.userData = { trial_activated: false }; // Fallback
        }
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
            }
        } catch (error) {
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
        } catch (error) {
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
        try {
            switch (action) {
                case 'buy':
                    // ✅ Используем правильный метод
                    await this.handleBuyNewSubscription();
                    break;

                case 'renew':
                    if (subscriptionId) {
                        // ✅ Используем правильный метод
                        await this.handleRenewSubscription(subscriptionId);
                    }
                    break;

                case 'activate-trial':
                    // ✅ Этот метод уже существует
                    await this.handleActivateTrial();
                    break;

                case 'instructions':
                    // ✅ Используем InstructionsScreen напрямую
                    if (window.InstructionsScreen) {
                        window.InstructionsScreen.show();
                    } else {
                        // Fallback - переход через роутер
                        if (window.Router) {
                            window.Router.navigate('instructions');
                        }
                    }
                    break;

                case 'support':
                    // ✅ Используем SupportScreen напрямую
                    if (window.SupportScreen) {
                        window.SupportScreen.show();
                    } else {
                        // Fallback - переход через роутер
                        if (window.Router) {
                            window.Router.navigate('support');
                        }
                    }
                    break;

                case 'news-channel':
                    this.openNewsChannel();
                    break;

                default:
            }
        } catch (error) {
            if (window.Toast) {
                window.Toast.error('Произошла ошибка при выполнении действия');
            }
        }

        // Вибрация для всех действий
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }
    },

    /**
     * Продление подписки
     */
    async handleRenewSubscription(subscriptionId) {
        if (window.ServiceSelector) {
            await window.ServiceSelector.show('renew', subscriptionId);
        }
    },

    /**
     * Покупка новой подписки
     */
    async handleBuyNewSubscription() {
        if (window.ServiceSelector) {
            await window.ServiceSelector.show('buy');
        }
    },

    /**
     * Открытие канала с новостями
     */
    openNewsChannel() {
        // URL вашего канала - замените на настоящий
        const channelUrl = 'https://t.me/dragon_vpn_news';

        try {
            if (window.TelegramApp) {
                // Используем встроенный метод Telegram для открытия ссылок
                window.TelegramApp.openTelegramLink(channelUrl);
            } else {
                // Fallback для веб-версии (разработка)
                window.open(channelUrl, '_blank');
            }
        } catch (error) {
            if (window.Toast) {
                window.Toast.error('Не удалось открыть канал');
            }
        }
    },

    /**
     * Активация пробного периода
     */
    async handleActivateTrial() {
        try {

            const confirmed = await this.showTrialConfirmationModal();
            if (!confirmed) return;

            // Показываем загрузку
            if (window.Loading) {
                window.Loading.show('Активация пробного периода...');
            }

            // ✅ ИСПРАВЛЕНИЕ: Используем правильный API метод
            const response = await window.SubscriptionAPI.activateTrial();

            if (window.Loading) {
                window.Loading.hide();
            }

            // Показываем анимацию успеха
            await this.showTrialActivationAnimation();

            // Обновляем данные подписок
            await this.refresh();

            // ✅ Сразу показываем инструкции
            setTimeout(() => {
                if (window.InstructionsScreen) {
                    window.InstructionsScreen.show();
                }
            }, 1000);

            // Вибрация успеха
            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

        } catch (error) {

            if (window.Loading) {
                window.Loading.hide();
            }

            if (window.Toast) {
                const message = error.message || 'Ошибка активации пробного периода';
                window.Toast.error(message);
            }
        }
    },

    async showTrialConfirmationModal() {
        return new Promise((resolve) => {
            if (window.Modal) {
                window.Modal.show({
                    title: 'Активировать пробный период?',
                    size: 'medium',
                    content: `
                        <div class="trial-confirmation-content">
                            <div class="trial-confirmation-icon">
                                <div id="trial-confirmation-animation" style="width: 64px; height: 64px; margin: 0 auto;"></div>
                            </div>

                            <div class="trial-confirmation-details">
                                <h3>Пробный период на 5 дней</h3>

                                <div class="trial-note">
                                    <i class="fas fa-info-circle"></i>
                                    <span>После окончания пробного периода подписка автоматически не продлится.</span>
                                </div>
                            </div>
                        </div>
                    `,
                    buttons: [
                        {
                            id: 'cancel',
                            text: 'Отмена',
                            action: 'cancel'
                        },
                        {
                            id: 'activate',
                            text: 'Активировать',
                            type: 'primary',
                            action: 'confirm'
                        }
                    ],
                    onConfirm: () => {
                        resolve(true);
                    },
                    onCancel: () => {
                        resolve(false);
                    },
                    onHide: () => {
                        this.isProcessingAction = false;
                    },
                    onShow: () => {
                        // ✅ Инициализируем анимацию в модалке
                        setTimeout(() => {
                            if (window.TGSLoader) {
                                window.TGSLoader.loadTGSAnimation(
                                    'trial-confirmation-animation',
                                    'assets/images/gifs/gift-animate.tgs',
                                    'fas fa-gift'
                                );
                            }
                        }, 100);
                    }
                });
            } else {
                // Fallback для Telegram
                resolve(window.TelegramApp?.showConfirm(
                    'Активировать пробный период на 5 дней бесплатно?\n\nАвтопродление отключено.'
                ));
            }
        });
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
        if (this.currentSubscriptions.length === 0) {
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
     * Инициализация TGS анимаций после рендера
     */
    initializeTGSAnimations() {
        // ✅ Просто вызываем универсальный метод
        if (window.TGSLoader) {
            window.TGSLoader.initializeScreen('subscription');
        } else {
        }
    },

    /**
     * Очистка TGS анимаций (для экономии памяти)
     */
    cleanupTGSAnimations() {
        // ✅ Просто вызываем универсальный cleanup
        if (window.TGSLoader) {
            window.TGSLoader.cleanupScreen('subscription');
        }
    },

    /**
     * Рендеринг пустого состояния
     */
    renderEmptyState() {
        const isTrialAvailable = !this.userData?.trial_activated;
        const trialTgs = isTrialAvailable ?
            'assets/images/gifs/gift-animate.tgs' :
            'assets/images/gifs/gift-opened.png';

        setTimeout(() => {
            this.initializeTGSAnimations();
        }, 100);

        return `
            <div class="section">
                <div class="empty-state-content">
                    <div class="empty-state-icon-gif">
                        <div id="tgs-animation-container" style="width: 80px; height: 80px; margin: 0 auto;"></div>
                    </div>
                    <h3 class="empty-state-title">Нет активных подписок</h3>
                </div>

                <!-- ПОДПИСКИ В СТЕКЛЕ С ЗАГОЛОВКОМ -->
                <div class="glass-actions-row">
                    <!-- ЗАГОЛОВОК С TGS АНИМАЦИЕЙ БЕЗ БОКСА -->
                    <div class="glass-section-header">
                        <div id="buy-subscription" style="width: 28px; height: 28px;"></div>
                        <h3 class="glass-section-title">Выберите подписку</h3>
                    </div>

                    <!-- СУЩЕСТВУЮЩИЕ КНОПКИ БЕЗ ИЗМЕНЕНИЙ -->
                    ${isTrialAvailable ? `
                        <div class="glass-action-card" data-action="activate-trial">
                            <div class="glass-action-content">
                                <div class="glass-action-icon">
                                    ${this.renderActionIcon('image', 'assets/images/icons/gift.png', 'fas fa-headset')}
                                </div>
                                <div class="glass-action-text">
                                    <div class="glass-action-title">Пробный период</div>
                                    <div class="glass-action-subtitle">5 дней бесплатно</div>
                                </div>
                                <div class="glass-action-arrow">
                                    <i class="fas fa-chevron-right"></i>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="glass-action-card trial-used-notice">
                            <div class="glass-action-content">
                                <div class="glass-action-icon" style="opacity: 0.4;">
                                    <div id="trial-used-tgs" style="width: 40px; height: 40px;" data-tgs="${trialTgs}"></div>
                                </div>
                                <div class="glass-action-text">
                                    <div class="glass-action-title" style="opacity: 0.6;">Пробный период</div>
                                    <div class="glass-action-subtitle" style="opacity: 0.6;">Уже использован</div>
                                </div>
                            </div>
                        </div>
                    `}

                    <div class="glass-action-card" data-action="buy">
                        <div class="glass-action-content">
                            ${this.renderActionIcon('image', 'assets/images/icons/crown.png', 'fas fa-crown')}
                            <div class="glass-action-text">
                                <div class="glass-action-title">Оформить подписку</div>
                                <div class="glass-action-subtitle">Выбрать тариф</div>
                            </div>
                            <div class="glass-action-arrow">
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                    </div>
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
                                    <div id="auto-renewal-animation-${subscription.id}" style="width: 32px; height: 32px;"></div>
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
        const hasActiveSubscription = this.currentSubscriptions.some(sub => {
            const daysLeft = Utils.daysBetween(sub.end_date);
            return daysLeft > 0;
        });

        return `
            <div class="section">
                <div class="glass-actions-row">
                    <div class="glass-section-header">
                        <div id="management-animation" style="width: 28px; height: 28px;"></div>
                        <h3 class="glass-section-title">Управление</h3>
                    </div>

                    <!-- СУЩЕСТВУЮЩИЕ КНОПКИ БЕЗ ИЗМЕНЕНИЙ -->
                    ${hasActiveSubscription ? `
                        <div class="glass-action-card" data-action="instructions">
                            <div class="glass-action-content">
                                ${this.renderActionIcon('icon', 'fas fa-book', 'fas fa-book')}
                                <div class="glass-action-text">
                                    <div class="glass-action-title">Инструкции</div>
                                    <div class="glass-action-subtitle">Настройка VPN</div>
                                </div>
                                <div class="glass-action-arrow">
                                    <i class="fas fa-chevron-right"></i>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    <div class="glass-action-card" data-action="support">
                        <div class="glass-action-content">
                            ${this.renderActionIcon('image', 'assets/images/icons/support.png', 'fas fa-headset')}
                            <div class="glass-action-text">
                                <div class="glass-action-title">Поддержка</div>
                                <div class="glass-action-subtitle">Помощь 24/7</div>
                            </div>
                            <div class="glass-action-arrow">
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                    </div>

                    <div class="glass-action-card" data-action="news-channel">
                        <div class="glass-action-content">
                            ${this.renderActionIcon('image', 'assets/images/icons/news.png', 'fas fa-newspaper')}
                            <div class="glass-action-text">
                                <div class="glass-action-title">Новости</div>
                                <div class="glass-action-subtitle">Наш канал</div>
                            </div>
                            <div class="glass-action-arrow">
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Создание HTML для иконки действия
     * @param {string} type - Тип действия (icon|image)
     * @param {string} source - Класс иконки или путь к картинке
     * @param {string} fallbackIcon - Fallback иконка
     */
    renderActionIcon(type, source, fallbackIcon = 'fas fa-circle') {
        if (type === 'image') {
            return `
                <div class="glass-action-icon has-image">
                    <img src="${source}" alt="Иконка"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <i class="${fallbackIcon}"></i>
                </div>
            `;
        } else {
            return `
                <div class="glass-action-icon">
                    <i class="${source}"></i>
                </div>
            `;
        }
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
                    <p class="trial-activation-subtitle">Вы получили 5 дней бесплатного доступа</p>
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