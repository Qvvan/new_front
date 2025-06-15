// Payments Screen for Dragon VPN Mini App
window.PaymentsScreen = {
    payments: [],
    services: new Map(), // Кеш сервисов по ID
    groupedPayments: new Map(),
    isLoaded: false,

    /**
     * Инициализация экрана платежей
     */
    async init() {
        Utils.log('info', 'Initializing Payments Screen');

        // Сначала загружаем сервисы, потом платежи
        await this.loadServices();
        await this.loadPayments();
        this.render();
        this.setupEventListeners(); // ✅ Перенес ПОСЛЕ render
        this.isLoaded = true;
    },

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const paymentsScreen = e.target.closest('#paymentsScreen');
            if (!paymentsScreen) return;

            const paymentItem = e.target.closest('.payment-item');
            if (paymentItem) {
                const paymentId = paymentItem.dataset.paymentId;
                this.showPaymentDetails(paymentId);
            }
        });
    },

    /**
     * Загрузка и кеширование всех сервисов
     */
    async loadServices() {
        try {
            const response = await window.ServiceAPI.getServices();
            const servicesList = response.services || [];

            // Кешируем сервисы по ID для быстрого доступа
            this.services.clear();
            servicesList.forEach(service => {
                this.services.set(service.id, service);
            });

            Utils.log('info', `Loaded and cached ${servicesList.length} services`);
        } catch (error) {
            Utils.log('error', 'Failed to load services:', error);
            // Продолжаем работу даже без сервисов
        }
    },

    /**
     * Загрузка платежей с обогащением данными сервисов
     */
    async loadPayments() {
        try {
            const response = await window.PaymentAPI.listPayments();
            this.payments = response.payments || [];

            // Обогащаем каждый платеж данными сервиса
            this.enrichPaymentsWithServiceData();
            this.groupPaymentsByDate();

            Utils.log('info', `Loaded ${this.payments.length} payments`);
        } catch (error) {
            Utils.log('error', 'Failed to load payments:', error);
            this.payments = [];

            if (window.Toast) {
                window.Toast.error('Ошибка загрузки платежей');
            }
        }
    },

    /**
     * Обогащение платежей данными сервисов
     */
    enrichPaymentsWithServiceData() {
        this.payments.forEach(payment => {
            const service = this.services.get(payment.service_id);

            if (service) {
                // Добавляем данные сервиса к платежу
                payment.service_name = service.name;
                payment.service_price = service.price;
                payment.service_duration_days = service.duration_days;
                payment.service_duration = this.formatDuration(service.duration_days);

                // ✅ ИСПРАВЛЕНО: Если в платеже нет цены, берем из сервиса
                if (!payment.price || payment.price === 0) {
                    payment.price = service.price;
                    Utils.log('info', `Set price ${service.price} for payment ${payment.id} from service ${service.name}`);
                }
            } else {
                // Fallback данные если сервис не найден
                payment.service_name = this.getServiceNameFallback(payment);
                payment.service_price = payment.price || 0;
                payment.service_duration = 'Неизвестно';

                // Пытаемся извлечь цену из описания
                if (!payment.price || payment.price === 0) {
                    payment.price = this.extractPriceFromDescription(payment.description) || 0;
                }
            }
        });
    },

    extractPriceFromDescription(description) {
        if (!description) return 0;

        // Ищем числа в описании
        const priceMatch = description.match(/(\d+)/);
        return priceMatch ? parseInt(priceMatch[1]) : 0;
    },

    /**
     * Форматирование продолжительности сервиса
     */
    formatDuration(days) {
        if (!days) return 'Неизвестно';

        if (days >= 365) {
            const years = Math.round(days / 365);
            return `${years} ${Utils.pluralize(years, ['год', 'года', 'лет'])}`;
        } else if (days >= 30) {
            const months = Math.round(days / 30);
            return `${months} ${Utils.pluralize(months, ['месяц', 'месяца', 'месяцев'])}`;
        } else {
            return `${days} ${Utils.pluralize(days, ['день', 'дня', 'дней'])}`;
        }
    },

    /**
     * Fallback название сервиса
     */
    getServiceNameFallback(payment) {
        // Пытаемся извлечь название из описания
        if (payment.description) {
            const serviceName = payment.description.split(' - ')[0];
            if (serviceName && serviceName !== payment.description) {
                return serviceName;
            }
        }

        // Определяем по service_type
        const typeMap = {
            'new': 'Новая подписка',
            'old': 'Продление подписки',
            'gift': 'Подарочная подписка',
            'trial': 'Пробный период'
        };

        return typeMap[payment.service_type] || 'VPN подписка';
    },

    /**
     * Группировка платежей по дате
     */
    groupPaymentsByDate() {
        this.groupedPayments.clear();

        this.payments.forEach(payment => {
            const date = new Date(payment.created_at);
            const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

            if (!this.groupedPayments.has(dateKey)) {
                this.groupedPayments.set(dateKey, []);
            }

            this.groupedPayments.get(dateKey).push(payment);
        });

        // Сортируем группы по дате (новые сверху)
        this.groupedPayments = new Map(
            [...this.groupedPayments.entries()].sort((a, b) => new Date(b[0]) - new Date(a[0]))
        );
    },

    /**
     * Рендеринг экрана
     */
    render() {
        const container = document.getElementById('paymentsScreen');
        if (!container) return;

        let content = '';

        if (this.payments.length === 0) {
            content = this.renderEmptyState();
        } else {
            content = this.renderPaymentHistory();
        }

        container.innerHTML = Utils.wrapContent(content);
        this.animateElements();
    },

    initializeTGSAnimations() {
        window.TGSLoader?.initializeScreen('payments');
    },

    cleanupTGSAnimations() {
        window.TGSLoader?.cleanupScreen('payments');
    },

    /**
     * Рендеринг пустого состояния
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-receipt"></i>
                </div>
                <h3 class="empty-state-title">Нет платежей</h3>
                <p class="empty-state-text">
                    История ваших платежей появится здесь
                </p>
                <div class="empty-state-actions">
                    <button class="btn btn-primary" onclick="window.Router.navigate('subscription')">
                        <i class="fas fa-shopping-cart"></i>
                        Оформить подписку
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг истории платежей
     */
    renderPaymentHistory() {
        let content = `
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-history"></i>
                    История платежей
                </h2>
            </div>
        `;

        for (const [dateKey, dayPayments] of this.groupedPayments) {
            content += this.renderDateGroup(dateKey, dayPayments);
        }

        return content;
    },

    /**
     * Рендеринг группы платежей по дате
     */
    renderDateGroup(dateKey, payments) {
        const date = new Date(dateKey);
        const dateLabel = this.formatDateLabel(date);
        const totalAmount = payments.reduce((sum, p) => sum + (p.price || 0), 0);

        let content = `
            <div class="payment-date-group">
                <div class="payment-date-header">
                    <h3 class="payment-date-title">${dateLabel}</h3>
                    <div class="payment-date-total">
                        ${Utils.formatPrice(totalAmount)}
                    </div>
                </div>
                <div class="payment-list">
        `;

        payments.forEach(payment => {
            content += this.renderPaymentItem(payment);
        });

        content += `
                </div>
            </div>
        `;

        return content;
    },

    /**
     * Рендеринг элемента платежа
     */
    renderPaymentItem(payment) {
        const isPending = payment.status === 'pending';
        const isSuccess = payment.status === 'succeeded';
        const isCanceled = payment.status === 'canceled';

        const statusClass = isPending ? 'pending' : isSuccess ? 'success' : 'canceled';
        const statusIcon = isPending ? 'fa-clock' : isSuccess ? 'fa-check' : 'fa-times';

        const serviceName = payment.service_name;
        const serviceDuration = payment.service_duration;
        const timeAgo = Utils.formatDate(payment.created_at, 'relative');
        const actualPrice = payment.price || 0;

        return `
            <div class="payment-item ${statusClass}" data-payment-id="${payment.id}">
                <div class="payment-item-icon">
                    <i class="fas ${statusIcon}"></i>
                </div>
                <div class="payment-item-info">
                    <div class="payment-item-service">${serviceName}</div>
                    <div class="payment-item-meta">
                        <span class="payment-duration">${serviceDuration}</span>
                        ${isPending ? '' : `• ${timeAgo}`}
                    </div>
                    ${isPending ? `
                        <div class="payment-pending-notice">
                            Нажмите, чтобы продолжить оплату
                        </div>
                    ` : ''}
                </div>
                <div class="payment-item-amount">
                    <div class="payment-amount">${Utils.formatPrice(actualPrice)}</div>
                    <div class="payment-status ${statusClass}">
                        ${isPending ? 'Ожидает' : isSuccess ? 'Оплачено' : 'Отменено'}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Форматирование даты для заголовка
     */
    formatDateLabel(date) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Сегодня';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Вчера';
        } else {
            return Utils.formatDate(date, 'long');
        }
    },

    /**
     * Показ деталей платежа
     */
    async showPaymentDetails(paymentId) {
        const payment = this.payments.find(p => p.id === paymentId);
        if (!payment) return;

        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }

        // ✅ ИСПРАВЛЕНИЕ: Для pending платежей сразу открываем оплату
        if (payment.status === 'pending') {
            const paymentUrl = payment.payment_url || payment.url;

            if (paymentUrl) {
                Utils.log('info', 'Opening pending payment URL:', paymentUrl);

                if (window.TelegramApp) {
                    window.TelegramApp.openLink(paymentUrl);
                } else {
                    window.open(paymentUrl, '_blank');
                }
                return; // ✅ Важно: выходим, не показываем модалку
            } else {
                // Если URL нет - пытаемся найти в Storage
                const pendingPayments = await window.Storage?.getPendingPayments() || [];
                const storedPayment = pendingPayments.find(p =>
                    p.id === payment.id || p.payment_id === payment.payment_id
                );

                if (storedPayment && storedPayment.payment_url) {
                    if (window.TelegramApp) {
                        window.TelegramApp.openLink(storedPayment.payment_url);
                    } else {
                        window.open(storedPayment.payment_url, '_blank');
                    }
                    return;
                } else {
                    // URL недоступен
                    if (window.Toast) {
                        window.Toast.warning('Ссылка на оплату недоступна');
                    }
                }
            }
        }

        // Для остальных статусов показываем детали в модальном окне
        this.showPaymentModal(payment);
    },

    /**
     * Модальное окно с деталями платежа
     */
    showPaymentModal(payment) {
        const isPending = payment.status === 'pending';
        const isSuccess = payment.status === 'succeeded';

        const statusText = isPending ? 'Ожидает оплаты' :
                          isSuccess ? 'Успешно оплачено' : 'Отменено';

        const statusClass = isPending ? 'pending' : isSuccess ? 'success' : 'canceled';

        // ✅ ИСПРАВЛЕНО: Правильно обрабатываем цены для отображения скидок
        const servicePrice = payment.service_price || 0;
        const actualPrice = payment.price || 0;
        const hasDiscount = servicePrice > actualPrice && actualPrice > 0 && servicePrice !== actualPrice;

        if (window.Modal) {
            window.Modal.show({
                title: 'Детали платежа',
                content: `
                    <div class="payment-details">
                        <div class="payment-detail-item">
                            <span class="detail-label">Сервис</span>
                            <span class="detail-value">${payment.service_name}</span>
                        </div>
                        <div class="payment-detail-item">
                            <span class="detail-label">Период</span>
                            <span class="detail-value">${payment.service_duration}</span>
                        </div>
                        <div class="payment-detail-item">
                            <span class="detail-label">Статус</span>
                            <span class="detail-value payment-status ${statusClass}">
                                ${statusText}
                            </span>
                        </div>
                        ${hasDiscount ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">Цена сервиса</span>
                                <span class="detail-value original-price">${Utils.formatPrice(servicePrice)}</span>
                            </div>
                            <div class="payment-detail-item">
                                <span class="detail-label">Скидка</span>
                                <span class="detail-value discount-amount">-${Utils.formatPrice(servicePrice - actualPrice)}</span>
                            </div>
                        ` : ''}
                        <div class="payment-detail-item">
                            <span class="detail-label">${hasDiscount ? 'Итого заплачено' : 'Сумма'}</span>
                            <span class="detail-value final-price">${Utils.formatPrice(actualPrice)}</span>
                        </div>
                        <div class="payment-detail-item">
                            <span class="detail-label">Дата создания</span>
                            <span class="detail-value">${Utils.formatDate(payment.created_at, 'long')}</span>
                        </div>
                        ${payment.payment_id ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">ID платежа</span>
                                <span class="detail-value payment-id">${payment.payment_id.slice(0, 16)}...</span>
                            </div>
                        ` : ''}
                    </div>
                `,
                buttons: [
                    {
                        id: 'close',
                        text: 'Закрыть',
                        action: 'close'
                    },
                    ...(payment.receipt_link ? [{
                        id: 'receipt',
                        text: 'Открыть чек',
                        type: 'primary',
                        handler: () => {
                            window.TelegramApp.openLink(payment.receipt_link);
                        }
                    }] : [])
                ]
            });
        }
    },

    /**
     * Анимация элементов
     */
    animateElements() {
        const elements = document.querySelectorAll('#paymentsScreen .payment-item');
        elements.forEach((el, index) => {
            el.classList.add('stagger-item');
            el.style.animationDelay = `${index * 0.05}s`;
        });
    },

    /**
     * Обновление данных
     */
    async refresh() {
        await this.loadServices();
        await this.loadPayments();
        this.render();
    },

    /**
     * Очистка
     */
    cleanup() {
        this.payments = [];
        this.services.clear();
        this.groupedPayments.clear();
        this.isLoaded = false;
    }
};