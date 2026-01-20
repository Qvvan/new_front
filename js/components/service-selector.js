// Service Selector Component for Dragon VPN Mini App

window.ServiceSelector = {
    isVisible: false,
    services: [],
    selectedService: null,
    mode: null, // 'buy', 'renew' или 'gift'
    subscriptionId: null,

    /**
     * Показать селектор услуг
     * @param {string} mode - Режим ('buy' или 'renew')
     * @param {string} subscriptionId - ID подписки для продления
     */
    async show(mode = 'buy', subscriptionId = null) {
        this.mode = mode;
        this.subscriptionId = subscriptionId;

        

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
        
        // ✅ Очищаем URL от параметров действия при закрытии
        // Но НЕ для режима gift - там URL должен сохраняться при переходе на Step2
        if (window.Router && this.mode !== 'gift') {
            window.Router.clearActionURL();
        }
    },

    /**
     * Загрузка списка услуг
     */
    async loadServices() {
        try {
            // Загружаем услуги
            if (window.ServiceAPI) {
                const response = await window.ServiceAPI.getServices();
                // Теперь API возвращает массив напрямую
                const servicesList = Array.isArray(response) ? response : (response.services || []);

                // Нормализуем данные с API
                this.services = servicesList.map(service => ({
                    ...service,
                    // Конвертируем duration_days в читаемый формат
                    duration: this.formatDuration(service.duration_days),
                    // Вычисляем discount_percent из price и original_price
                    discount: service.has_discount && service.discount_percent ? service.discount_percent : 0,
                    // Используем is_featured как popular
                    popular: service.is_featured || false
                }));

                // Отделяем пробный период от обычных услуг
                this.trialService = this.services.find(s => s.is_trial) || null;
                this.services = this.services.filter(s => !s.is_trial);
            }

            // Загружаем данные пользователя для пробного периода
            await this.loadUserData();

            

        } catch (error) {
            
            throw error;
        } finally {
        }
    },

    async loadUserData() {
        try {
            if (window.UserAPI) {
                const response = await window.UserAPI.getCurrentUser();
                this.userData = response.user || response;
                
            } else {
                this.userData = { trial_activated: false }; // Fallback
            }
        } catch (error) {
            
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

        const titleText = this.mode === 'renew' ? 'Продление подписки' : (this.mode === 'gift' ? 'Подарить подписку' : 'Новая подписка');

        // ⚠️ Добавляем иконки к пояснениям
        let explanationText = '';
        if (this.mode === 'renew') {
            explanationText = '<i class="fas fa-sync-alt"></i>Выберите тариф для продления. Новый период добавится к текущему.';
        } else if (this.mode === 'gift') {
            explanationText = '<i class="fas fa-gift"></i>Выберите подписку, которую хотите подарить.';
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
                    ${this.mode !== 'gift' ? this.renderTrialService() : ''}
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
        // Сортируем по sort_order, затем по цене
        const sortedServices = [...this.services].sort((a, b) => {
            if (a.sort_order !== b.sort_order) {
                return (a.sort_order || 0) - (b.sort_order || 0);
            }
            return parseFloat(a.price) - parseFloat(b.price);
        });

        return sortedServices.map(service => {
            const hasDiscount = service.has_discount && service.original_price && parseFloat(service.original_price) > parseFloat(service.price);
            const originalPrice = service.original_price || service.price;
            const isBestValue = service.is_featured || hasDiscount;
            
            return `
                <div class="service-card-compact ${isBestValue ? 'featured' : ''}" data-service-id="${service.service_id}">
                    ${service.badge ? `<div class="service-badge">${service.badge}</div>` : ''}
                    ${hasDiscount ? `<div class="service-discount-badge">-${service.discount_percent}%</div>` : ''}
                    <div class="service-compact-content">
                        <div class="service-compact-pricing">
                            ${hasDiscount ? `<div class="service-original-price">${Utils.formatPrice(originalPrice)}</div>` : ''}
                            <div class="service-compact-price ${hasDiscount ? 'has-discount' : ''}">${Utils.formatPrice(service.price)}</div>
                        </div>
                        <div class="service-compact-period">${this.formatDuration(service.duration_days)}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    // Рендеринг пробного периода (теперь это обычная услуга с is_trial)
    renderTrialService() {
        const isActivated = this.userData?.trial_activated || false;
        const trialService = this.trialService;

        // Если нет пробной услуги, не показываем
        if (!trialService) {
            return '';
        }

        // ✅ Планируем инициализацию анимации ПОСЛЕ рендера DOM
        setTimeout(() => {
            if (window.TGSLoader) {
                const tgsPath = isActivated ?
                    'assets/images/gifs/gift-opened.png' :
                    'assets/images/gifs/gift-animate.tgs';

                window.TGSLoader.loadTGSAnimation(
                    `trial-gift-animation-${isActivated ? 'used' : 'available'}`,
                    tgsPath,
                    'fas fa-gift'
                );
            }
        }, 100);

        return `
            <div class="trial-service ${isActivated ? 'trial-activated' : 'trial-available'}" data-service-id="${trialService.service_id}">
                <div class="service-badge trial-badge">Бесплатно</div>
                <div class="trial-content">
                    <div class="trial-icon">
                        <div id="trial-gift-animation-${isActivated ? 'used' : 'available'}" style="width: 48px; height: 48px;"></div>
                    </div>
                    <div class="trial-info">
                        <h4 class="trial-title">${trialService.name}</h4>
                        <div class="trial-duration">${this.formatDuration(trialService.duration_days)}</div>
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
        // ✅ Обновляем URL при выборе услуги
        if (window.Router && serviceId) {
            if (this.mode === 'gift') {
                window.Router.updateURLForAction('gift', { service_id: serviceId });
            } else {
                window.Router.updateURLForAction('services', { 
                    mode: this.mode, 
                    service_id: serviceId,
                    subscription_id: this.subscriptionId 
                });
            }
        }
        // ✅ Нормализуем serviceId (может быть строка или число)
        const normalizedId = typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId;
        
        if (isNaN(normalizedId)) {
            return;
        }

        // Проверяем, является ли это пробным периодом (по service_id)
        const isTrialService = this.trialService && 
            (this.trialService.service_id === normalizedId || this.trialService.id === normalizedId);
        
        if (isTrialService) {
            if (this.userData?.trial_activated) {
                if (window.Toast) {
                    window.Toast.warning('Пробный период уже использован');
                }
                return;
            }
            this.selectedService = this.trialService;
        } else {
            // ✅ Ищем по service_id или id
            const service = this.services.find(s => 
                s.service_id === normalizedId || s.id === normalizedId
            );
            if (!service) {
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
        // ✅ Пробуем найти по разным вариантам ID
        let selectedCard = modal.querySelector(`[data-service-id="${normalizedId}"]`);
        if (!selectedCard) {
            selectedCard = modal.querySelector(`[data-service-id="${serviceId}"]`);
        }
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }

        // Активируем кнопку продолжения
        const continueBtn = modal.querySelector('#serviceSelectorContinue');
        if (continueBtn) {
            continueBtn.disabled = false;
        }

        
    },

    /**
     * Обработка продолжения
     */
    async handleContinue() {
        if (!this.selectedService) return;

        try {
            // ✅ Обновляем URL с выбранной услугой
            if (window.Router) {
                const serviceId = this.selectedService.service_id || this.selectedService.id;
                if (this.mode === 'gift') {
                    window.Router.updateURLForAction('gift', { service_id: serviceId });
                } else {
                    window.Router.updateURLForAction('services', { 
                        mode: this.mode, 
                        service_id: serviceId,
                        subscription_id: this.subscriptionId 
                    });
                }
            }

            // ✅ Для режима подарка переходим к следующему шагу
            if (this.mode === 'gift') {
                await this.handleGiftContinue();
                return;
            }

            // ✅ Для пробного периода используем отдельный метод
            if (this.selectedService.is_trial) {
                await this.activateTrial();
            } else {
                await this.createPayment();
            }

        } catch (error) {
            
            if (window.Toast) {
                window.Toast.show('Ошибка создания платежа', 'error');
            }
        }
    },

    /**
     * Обработка продолжения для подарка
     */
    async handleGiftContinue() {
        if (!this.selectedService || this.mode !== 'gift') return;

        // Сохраняем выбранную услугу в GiftFlow
        if (window.GiftFlow) {
            window.GiftFlow.selectedService = this.selectedService;
            window.GiftFlow.giftData.service_id = this.selectedService.service_id || this.selectedService.id;
            
            // ✅ Обновляем URL с выбранной услугой ПЕРЕД переходом на Step2
            if (window.Router) {
                const serviceId = this.selectedService.service_id || this.selectedService.id;
                window.Router.updateURLForAction('gift', { service_id: serviceId, step: 2 });
            }
            
            // Скрываем ServiceSelector (но НЕ очищаем URL)
            this.isVisible = false;
            const modal = this.getModalElement();
            if (modal) {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.remove();
                    this.cleanup();
                }, 300);
            }
            
            // Переходим к шагу 2 (получатель и сообщение)
            window.GiftFlow.showStep2();
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
            // Получаем user_id из текущего пользователя
            let userId = null;
            try {
                const user = await window.UserAPI.getCurrentUser();
                userId = user.telegram_id || user.user_id;
            } catch (error) {
                
            }

            let response;
            const serviceId = this.selectedService.service_id;

            if (this.mode === 'renew') {
                // Создание платежа за продление
                response = await window.PaymentAPI.createRenewalPayment({
                    subscription_id: this.subscriptionId,
                    service_id: serviceId
                }, userId);
            } else {
                // Создание платежа за новую подписку
                response = await window.PaymentAPI.createSubscriptionPayment({
                    service_id: serviceId
                }, userId);
            }

            // API возвращает { payment: {...}, confirmation_url: "..." }
            const payment = response.payment || response;
            const confirmationUrl = response.confirmation_url || payment.confirmation_url || response.url || payment.url;

            // ✅ Обогащаем данными сервиса
            payment.service_name = this.selectedService.name;
            payment.service_duration = this.selectedService.duration || this.formatDuration(this.selectedService.duration_days);
            payment.service_original_price = this.selectedService.original_price || this.selectedService.price;

            if (!payment.amount && !payment.price) {
                payment.amount = parseFloat(this.selectedService.price);
                payment.price = this.selectedService.price;
            }

            // ✅ Правильно передаем URL - используем confirmation_url из ответа или из payment
            const paymentWithUrl = {
                ...payment,
                payment_url: confirmationUrl,
                url: confirmationUrl,
                confirmation_url: confirmationUrl
            };

            // Сохраняем в pending платежи перед открытием
            if (window.Storage && payment.id && payment.status === 'pending') {
                await window.Storage.addPendingPayment(paymentWithUrl);
            }

            // Добавляем в мониторинг
            if (window.PaymentMonitor && payment.status === 'pending') {
                const paymentId = payment.payment_id || payment.id;
                if (paymentId) {
                    window.PaymentMonitor.addPayment(paymentId);
                }
            }

            this.hide();

            // ✅ ВАЖНО: Сначала открываем страницу оплаты
            if (confirmationUrl) {
                if (window.TelegramApp) {
                    window.TelegramApp.openLink(confirmationUrl);
                } else {
                    window.open(confirmationUrl, '_blank');
                }
            } else {
                
                if (window.Toast) {
                    window.Toast.error('Ссылка на оплату недоступна');
                }
            }

            // Показываем баннер после открытия оплаты
            if (window.PaymentBanner && payment.status === 'pending') {
                window.PaymentBanner.show(paymentWithUrl);
            }

            

        } catch (error) {
            
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