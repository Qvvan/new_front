// Service Selector Component for Dragon VPN Mini App

window.ServiceSelector = {
    isVisible: false,
    services: [],
    selectedService: null,
    mode: null, // 'buy' или 'renew'
    subscriptionId: null,

    /**
     * Показать селектор услуг
     * @param {string} mode - Режим ('buy' или 'renew')
     * @param {string} subscriptionId - ID подписки для продления
     */
    async show(mode = 'buy', subscriptionId = null) {
        this.mode = mode;
        this.subscriptionId = subscriptionId;

        Utils.log('info', `Showing service selector in ${mode} mode`, { subscriptionId });

        try {
            await this.loadServices();

            // ⚠️ СНАЧАЛА добавляем в DOM
            const modal = this.getModalElement();
            document.body.appendChild(modal);

            // ⚠️ ПОТОМ рендерим и настраиваем события
            this.render();
            this.isVisible = true;

            // Показываем с анимацией
            setTimeout(() => {
                modal.classList.add('active');
            }, 10);

            // Вибрация
            if (window.TelegramApp) {
                window.TelegramApp.haptic.light();
            }

        } catch (error) {
            Utils.log('error', 'Failed to show service selector:', error);
            if (window.Toast) {
                window.Toast.show('Ошибка загрузки услуг', 'error');
            }
        }
    },

    /**
     * Скрыть селектор услуг
     */
    hide() {
        if (!this.isVisible) return;

        const modal = this.getModalElement();
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                this.cleanup();
            }, 300);
        }

        this.isVisible = false;
    },

    /**
     * Загрузка списка услуг
     */
    async loadServices() {
        try {
            // Загружаем услуги
            if (window.ServiceAPI) {
                const response = await window.ServiceAPI.getServices();
                this.services = response.services || [];

                // Нормализуем данные с API
                this.services = this.services.map(service => ({
                    ...service,
                    features: service.features || [],
                    currency: service.currency || 'RUB',
                    discount: service.discount || 0,
                    popular: service.popular || false,
                    // Конвертируем duration_days в читаемый формат
                    duration: this.formatDuration(service.duration_days)
                }));
            }

            // ⚠️ НОВОЕ: Загружаем данные пользователя для пробного периода
            await this.loadUserData();

            Utils.log('info', 'Services loaded:', this.services);

        } catch (error) {
            Utils.log('error', 'Failed to load services:', error);
            throw error;
        } finally {
        }
    },

    async loadUserData() {
        try {
            if (window.UserAPI) {
                const response = await window.UserAPI.getCurrentUser();
                this.userData = response.user || response;
                Utils.log('info', 'User data loaded:', this.userData);
            } else {
                this.userData = { trial_activated: false }; // Fallback
            }
        } catch (error) {
            Utils.log('error', 'Failed to load user data:', error);
            this.userData = { trial_activated: false };
        }
    },

    // ⚠️ НОВЫЙ метод для форматирования продолжительности
    formatDuration(days) {
        if (days >= 360) return `${Math.round(days / 365)} год`;
        if (days >= 30) return `${Math.round(days / 30)} мес`;
        return `${days} дн`;
    },

    /**
     * Рендеринг селектора
     */
    render() {
        const modal = this.getModalElement();

        const titleText = this.mode === 'renew' ? 'Продление подписки' : 'Новая подписка';

        // ⚠️ Добавляем иконки к пояснениям
        let explanationText = '';
        if (this.mode === 'renew') {
            explanationText = '<i class="fas fa-sync-alt"></i>Выберите тариф для продления. Новый период добавится к текущему.';
        } else {
            const hasActiveSubscription = this.checkForActiveSubscriptions();
            if (hasActiveSubscription) {
                explanationText = '<i class="fas fa-info-circle"></i>У вас уже есть подписка. Оплата создаст новую отдельную подписку.';
            } else {
                explanationText = '<i class="fas fa-rocket"></i>Выберите подходящий тариф для начала работы с VPN.';
            }
        }

        modal.innerHTML = `
            <div class="modal modal-services">
                <div class="modal-header">
                    <div class="modal-title">
                        <i class="fas fa-shopping-cart"></i>
                        ${titleText}
                    </div>
                    <button class="modal-close" id="serviceSelectorClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="service-explanation">
                        ${explanationText}
                    </div>
                    <div class="services-grid-compact">
                        ${this.renderCompactServices()}
                    </div>
                    ${this.renderTrialService()}
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="serviceSelectorCancel">
                        Отмена
                    </button>
                    <button class="btn btn-primary" id="serviceSelectorContinue" disabled>
                        <i class="fas fa-arrow-right"></i>
                        Продолжить
                    </button>
                </div>
            </div>
        `;

        this.setupEventListeners();
    },

    checkForActiveSubscriptions() {
        // Если есть SubscriptionScreen, проверяем его данные
        if (window.SubscriptionScreen && window.SubscriptionScreen.currentSubscriptions) {
            const activeSubscriptions = window.SubscriptionScreen.currentSubscriptions.filter(sub => {
                const daysLeft = Utils.daysBetween(sub.end_date);
                return daysLeft > 0 && (sub.status === 'active' || sub.status === 'trial');
            });
            return activeSubscriptions.length > 0;
        }
        return false;
    },

    renderCompactServices() {
        const sortedServices = [...this.services].sort((a, b) => a.price - b.price);

        return sortedServices.map(service => {
            return `
                <div class="service-card-compact" data-service-id="${service.id}">
                    <div class="service-compact-content">
                        <h4 class="service-compact-name">${service.name}</h4>
                        <div class="service-compact-price">${Utils.formatPrice(service.price)}</div>
                        <div class="service-compact-period">${this.formatDuration(service.duration_days)}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    // ⚠️ НОВЫЙ рендеринг пробного периода
    renderTrialService() {
        const isActivated = this.userData?.trial_activated || false;

        // ✅ Планируем инициализацию анимации ПОСЛЕ рендера DOM
        setTimeout(() => {
            if (window.TGSLoader) {
                const tgsPath = isActivated ?
                    'assets/images/gifs/gift-opened.tgs' :
                    'assets/images/gifs/gift-animate.tgs';

                window.TGSLoader.loadTGSAnimation(
                    `trial-gift-animation-${isActivated ? 'used' : 'available'}`,
                    tgsPath,
                    'fas fa-gift'
                );
            }
        }, 100);

        return `
            <div class="trial-service ${isActivated ? 'trial-activated' : 'trial-available'}" data-service-id="trial">
                <div class="trial-content">
                    <div class="trial-icon">
                        <div id="trial-gift-animation-${isActivated ? 'used' : 'available'}" style="width: 48px; height: 48px;"></div>
                    </div>
                    <div class="trial-info">
                        <h4 class="trial-title">Бесплатный период</h4>
                        <div class="trial-duration">5 дней</div>
                    </div>
                    <div class="trial-status">
                        ${isActivated ? 'Использован' : 'Доступен'}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг списка услуг
     */
    renderServices() {
        return this.services.map(service => {
            const monthlyPrice = this.calculateMonthlyPrice(service);
            const originalPrice = service.original_price || service.price;
            const hasDiscount = service.discount && service.discount > 0;

            // ⚠️ Защита от отсутствующих features
            const features = service.features || [];

            return `
                <div class="service-card" data-service-id="${service.id}">
                    ${service.popular ? '<div class="service-badge">Популярный</div>' : ''}
                    ${hasDiscount ? `<div class="service-discount">-${service.discount}%</div>` : ''}

                    <div class="service-header">
                        <div class="service-info">
                            <h4 class="service-name">${service.name}</h4>
                            <p class="service-duration">${service.duration || 'Не указано'}</p>
                        </div>
                        <div class="service-pricing">
                            <div class="service-price">${Utils.formatPrice(service.price, service.currency)}</div>
                            ${hasDiscount ? `<div class="service-original-price">${Utils.formatPrice(originalPrice, service.currency)}</div>` : ''}
                            <div class="service-monthly">${Utils.formatPrice(monthlyPrice, service.currency)}/мес</div>
                        </div>
                    </div>

                    <ul class="service-features">
                        ${features.map(feature => `<li>${feature}</li>`).join('')}
                    </ul>

                    ${hasDiscount ? `
                        <div class="service-savings">
                            Экономия: ${Utils.formatPrice(originalPrice - service.price, service.currency)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    /**
     * Вычисление месячной цены
     */
    calculateMonthlyPrice(service) {
        // Парсим продолжительность более надежно
        const duration = service.duration || service.duration_days;

        let months = 1;
        if (typeof duration === 'string') {
            const durationMap = {
                '1 месяц': 1,
                '3 месяца': 3,
                '6 месяцев': 6,
                '12 месяцев': 12
            };
            months = durationMap[duration] || 1;
        } else if (typeof duration === 'number') {
            // Если duration_days приходит как число дней
            months = Math.max(1, Math.round(duration / 30));
        }

        return Math.round((service.price || 0) / months);
    },

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        const modal = this.getModalElement();

        if (!modal) {
            Utils.log('error', 'Modal element not found in setupEventListeners');
            return;
        }

        // Закрытие модального окна
        const closeBtn = modal.querySelector('#serviceSelectorClose');
        const cancelBtn = modal.querySelector('#serviceSelectorCancel');
        const continueBtn = modal.querySelector('#serviceSelectorContinue');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hide();
            });
        }

        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.handleContinue();
            });
        }

        // ⚠️ ИСПРАВЛЯЕМ: Выбор услуги - правильные селекторы
        modal.addEventListener('click', (e) => {
            // Проверяем клик по обычным услугам
            const serviceCard = e.target.closest('.service-card-compact');
            if (serviceCard) {
                const serviceId = serviceCard.dataset.serviceId;
                this.selectService(serviceId);

                // Вибрация
                if (window.TelegramApp) {
                    window.TelegramApp.haptic.selection();
                }
                return;
            }

            // Проверяем клик по пробному периоду
            const trialCard = e.target.closest('.trial-service');
            if (trialCard) {
                const serviceId = trialCard.dataset.serviceId;
                this.selectService(serviceId);

                // Вибрация
                if (window.TelegramApp) {
                    window.TelegramApp.haptic.selection();
                }
                return;
            }
        });

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hide();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', this.handleEscapeKey.bind(this));
    },

    /**
     * Выбор услуги
     */
    selectService(serviceId) {
        // Проверяем пробный период
        if (serviceId === 'trial') {
            if (this.userData?.trial_activated) {
                if (window.Toast) {
                    window.Toast.warning('Пробный период уже использован');
                }
                return;
            }

            this.selectedService = {
                id: 'trial',
                name: 'Пробный период',
                price: 0,
                duration_days: 7,
                type: 'trial'
            };
        } else {
            const service = this.services.find(s => s.id === serviceId);
            if (!service) {
                Utils.log('error', 'Service not found:', serviceId);
                return;
            }
            this.selectedService = service;
        }

        const modal = this.getModalElement();
        if (!modal) return;

        // ⚠️ ИСПРАВЛЯЕМ: Убираем все выделения
        modal.querySelectorAll('.service-card-compact.selected, .trial-service.selected').forEach(card => {
            card.classList.remove('selected');
        });

        // ⚠️ ИСПРАВЛЯЕМ: Выделяем выбранный элемент
        const selectedCard = modal.querySelector(`[data-service-id="${serviceId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        } else {
            Utils.log('error', 'Selected card not found:', serviceId);
        }

        // Активируем кнопку продолжения
        const continueBtn = modal.querySelector('#serviceSelectorContinue');
        if (continueBtn) {
            continueBtn.disabled = false;
        }

        Utils.log('info', 'Service selected:', this.selectedService);
    },

    /**
     * Обработка продолжения
     */
    async handleContinue() {
        if (!this.selectedService) return;

        try {
            Utils.log('info', 'Processing service selection:', {
                service: this.selectedService,
                mode: this.mode,
                subscriptionId: this.subscriptionId
            });

            // ✅ ИСПРАВЛЕНИЕ: Для пробного периода используем отдельный метод
            if (this.selectedService.id === 'trial') {
                await this.activateTrial();
            } else {
                await this.createPayment();
            }

        } catch (error) {
            Utils.log('error', 'Failed to process service selection:', error);
            if (window.Toast) {
                window.Toast.show('Ошибка создания платежа', 'error');
            }
        }
    },

    async activateTrial() {
        try {
            this.hide();

            // Вызываем тот же метод, что и в SubscriptionScreen
            if (window.SubscriptionScreen) {
                await window.SubscriptionScreen.handleActivateTrial();
            } else {
                // Fallback - прямой вызов API
                const response = await window.SubscriptionAPI.activateTrial();

                if (window.Toast) {
                    window.Toast.success('Пробный период активирован!');
                }

                // Обновляем экран подписок
                if (window.SubscriptionScreen) {
                    await window.SubscriptionScreen.refresh();
                }
            }

        } catch (error) {
            Utils.log('error', 'Failed to activate trial:', error);
            if (window.Toast) {
                window.Toast.error(error.message || 'Ошибка активации пробного периода');
            }
            throw error;
        }
    },

    /**
     * Создание платежа
     */
    async createPayment() {
        try {
            const paymentData = {
                service_id: this.selectedService.id,
                service_type: this.mode === 'renew' ? 'old' : 'new',
                subscription_id: this.subscriptionId || undefined,
            };

            const response = await window.PaymentAPI.createPaymentWithMonitoring(paymentData);
            const payment = response.payment || response;

            // ✅ Обогащаем данными сервиса
            payment.service_name = this.selectedService.name;
            payment.service_duration = this.selectedService.duration;
            payment.service_original_price = this.selectedService.price;

            if (!payment.price) {
                payment.price = this.selectedService.price;
            }

            // ✅ Правильно передаем URL - используем receipt_link из API
            const paymentWithUrl = {
                ...payment,
                payment_url: response.receipt_link || response.url, // ← Правильное поле
                url: response.receipt_link || response.url
            };

            this.hide();

            // Показываем баннер
            if (window.PaymentBanner) {
                window.PaymentBanner.show(paymentWithUrl);
            }

            // Открываем страницу оплаты
            const paymentUrl = response.receipt_link || response.url;
            if (paymentUrl && window.TelegramApp) {
                window.TelegramApp.openLink(paymentUrl);
            }

            Utils.log('info', 'Payment created and monitoring started:', payment.id);

        } catch (error) {
            Utils.log('error', 'Failed to create payment:', error);
            if (window.Toast) {
                window.Toast.error(error.message || 'Ошибка создания платежа');
            }
            throw error;
        }
    },

    /**
     * Обработка клавиши Escape
     */
    handleEscapeKey(e) {
        if (e.key === 'Escape' && this.isVisible) {
            this.hide();
        }
    },

    /**
     * Получение элемента модального окна
     */
    getModalElement() {
        let modal = document.getElementById('serviceSelector');
        if (!modal) {
            modal = Utils.createElement('div', {
                id: 'serviceSelector',
                className: 'modal-overlay'
            });
        }
        return modal;
    },

    /**
     * Очистка данных
     */
    cleanup() {
        this.selectedService = null;
        this.mode = null;
        this.subscriptionId = null;
        this.services = [];

        // Убираем обработчик Escape
        document.removeEventListener('keydown', this.handleEscapeKey.bind(this));
    },

    /**
     * Получение выбранной услуги
     */
    getSelectedService() {
        return this.selectedService;
    },

    /**
     * Проверка видимости
     */
    isShown() {
        return this.isVisible;
    },

    /**
     * Обновление списка услуг
     */
    async refresh() {
        if (this.isVisible) {
            await this.loadServices();
            this.render();
        }
    }
};