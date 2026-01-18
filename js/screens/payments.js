// Payments Screen for Dragon VPN Mini App
window.PaymentsScreen = {
    payments: [],
    currencyTransactions: [],
    gifts: [],
    services: new Map(), // Кеш сервисов по ID
    groupedPayments: new Map(),
    allActions: [], // Все действия объединенные
    isLoaded: false,

    /**
     * Инициализация экрана платежей
     */
    async init() {
        await this.loadServices();
        await this.loadPayments();
        await this.loadCurrencyTransactions();
        await this.loadGifts();
        this.render();
        this.setupEventListeners();
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
                if (paymentItem.dataset.paymentId) {
                    this.showPaymentDetails(paymentItem.dataset.paymentId);
                } else if (paymentItem.dataset.giftId) {
                    this.showGiftDetails(paymentItem.dataset.giftId);
                } else if (paymentItem.dataset.transactionId) {
                    this.showTransactionDetails(paymentItem.dataset.transactionId);
                }
            }
        });
    },

    /**
     * Показ деталей подарка
     */
    async showGiftDetails(giftId) {
        const gift = this.gifts.find(g => (g.gift_id === giftId) || (g.id === giftId));
        if (!gift) return;

        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }

        const canRefund = gift.status === 'pending' && !gift.activated_at && gift.gift_code;

        if (window.Modal) {
            window.Modal.show({
                title: 'Детали подарка',
                content: `
                    <div class="payment-details">
                        <div class="payment-detail-item">
                            <span class="detail-label">Статус</span>
                            <span class="detail-value payment-status ${gift.status}">
                                ${gift.status === 'activated' ? 'Активирован' : 
                                  gift.status === 'pending' ? 'Ожидает активации' : 'Отменен'}
                            </span>
                        </div>
                        ${gift.gift_code ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">Код активации</span>
                                <span class="detail-value">${gift.gift_code}</span>
                            </div>
                        ` : ''}
                        ${gift.recipient_user_id ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">Получатель</span>
                                <span class="detail-value">ID: ${gift.recipient_user_id}</span>
                            </div>
                        ` : ''}
                        ${gift.activated_at ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">Активирован</span>
                                <span class="detail-value">${Utils.formatDate(gift.activated_at, 'long')}</span>
                            </div>
                        ` : ''}
                        <div class="payment-detail-item">
                            <span class="detail-label">Дата создания</span>
                            <span class="detail-value">${Utils.formatDate(gift.created_at, 'long')}</span>
                        </div>
                    </div>
                `,
                buttons: [
                    ...(canRefund ? [{
                        id: 'refund',
                        text: 'Запросить возврат',
                        type: 'warning',
                        handler: () => this.handleGiftRefund(gift)
                    }] : []),
                    {
                        id: 'close',
                        text: 'Закрыть',
                        action: 'close'
                    }
                ]
            });
        }
    },

    /**
     * Обработка возврата подарка
     */
    async handleGiftRefund(gift) {
        const confirmed = await window.Modal?.showConfirm(
            'Запросить возврат средств?',
            'Код подарка будет деактивирован, а средства возвращены на ваш счет.'
        );

        if (!confirmed) return;

        try {
            if (window.Loading) {
                window.Loading.show('Обработка возврата...');
            }

            await window.GiftAPI.refundGift(gift.gift_id || gift.id);

            if (window.Loading) {
                window.Loading.hide();
            }

            if (window.Toast) {
                window.Toast.success('Запрос на возврат отправлен');
            }

            // Обновляем данные
            await this.refresh();

            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

        } catch (error) {
            if (window.Loading) {
                window.Loading.hide();
            }

            Utils.log('error', 'Failed to refund gift:', error);
            if (window.Toast) {
                window.Toast.error(error.data?.comment || error.message || 'Ошибка возврата средств');
            }
        }
    },

    /**
     * Показ деталей транзакции валюты
     */
    async showTransactionDetails(transactionId) {
        const transaction = this.currencyTransactions.find(t => 
            (t.transaction_id === transactionId) || (t.id === transactionId)
        );
        if (!transaction) return;

        if (window.Modal) {
            window.Modal.show({
                title: 'Детали транзакции',
                content: `
                    <div class="payment-details">
                        <div class="payment-detail-item">
                            <span class="detail-label">Тип</span>
                            <span class="detail-value">${transaction.description || this.getCurrencyTransactionType(transaction.transaction_type)}</span>
                        </div>
                        <div class="payment-detail-item">
                            <span class="detail-label">Сумма</span>
                            <span class="detail-value">${transaction.amount} DRG</span>
                        </div>
                        <div class="payment-detail-item">
                            <span class="detail-label">Баланс после</span>
                            <span class="detail-value">${transaction.balance_after} DRG</span>
                        </div>
                        <div class="payment-detail-item">
                            <span class="detail-label">Дата</span>
                            <span class="detail-value">${Utils.formatDate(transaction.created_at, 'long')}</span>
                        </div>
                    </div>
                `,
                buttons: [{
                    id: 'close',
                    text: 'Закрыть',
                    action: 'close'
                }]
            });
        }
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
        } catch (error) {
            // Продолжаем работу даже без сервисов
        }
    },

    /**
     * Загрузка платежей с обогащением данными сервисов
     */
    async loadPayments() {
        try {
            // Получаем user_id из текущего пользователя
            let userId = null;
            try {
                const user = await window.UserAPI.getCurrentUser();
                userId = user.telegram_id || user.user_id;
            } catch (error) {
                Utils.log('error', 'Failed to get user ID:', error);
            }

            if (!userId) {
                this.payments = [];
                return;
            }

            const response = await window.PaymentAPI.listPayments(userId, { limit: 50, offset: 0 });
            this.payments = response.payments || [];

            // Обогащаем каждый платеж данными сервиса
            this.enrichPaymentsWithServiceData();
            this.groupPaymentsByDate();
        } catch (error) {
            this.payments = [];

            if (window.Toast) {
                window.Toast.error('Ошибка загрузки платежей');
            }
        }
    },

    /**
     * Загрузка транзакций валюты
     */
    async loadCurrencyTransactions() {
        try {
            const response = await window.CurrencyAPI.getTransactions({ limit: 50, offset: 0 });
            this.currencyTransactions = response.transactions || [];
        } catch (error) {
            this.currencyTransactions = [];
            Utils.log('error', 'Failed to load currency transactions:', error);
        }
    },

    /**
     * Загрузка подарков
     */
    async loadGifts() {
        try {
            // Получаем user_id из текущего пользователя
            let userId = null;
            try {
                const user = await window.UserAPI.getCurrentUser();
                userId = user.telegram_id || user.user_id;
            } catch (error) {
                Utils.log('error', 'Failed to get user ID:', error);
            }

            if (!userId) {
                this.gifts = [];
                return;
            }

            // Загружаем pending и sent подарки
            const [pendingGifts, sentGifts] = await Promise.all([
                window.GiftAPI.getPendingGifts(userId).catch(() => []),
                window.GiftAPI.getSentGifts(userId).catch(() => [])
            ]);

            // Объединяем подарки
            this.gifts = [...pendingGifts, ...sentGifts];
        } catch (error) {
            this.gifts = [];
            Utils.log('error', 'Failed to load gifts:', error);
        }
    },

    /**
     * Объединение всех действий (платежи, транзакции, подарки) для отображения
     */
    combineAllActions() {
        this.allActions = [];

        // Добавляем платежи
        this.payments.forEach(payment => {
            this.allActions.push({
                type: 'payment',
                data: payment,
                date: new Date(payment.created_at)
            });
        });

        // Добавляем транзакции валюты
        this.currencyTransactions.forEach(transaction => {
            this.allActions.push({
                type: 'currency',
                data: transaction,
                date: new Date(transaction.created_at)
            });
        });

        // Добавляем подарки
        this.gifts.forEach(gift => {
            this.allActions.push({
                type: 'gift',
                data: gift,
                date: new Date(gift.created_at)
            });
        });

        // Сортируем по дате (новые сверху)
        this.allActions.sort((a, b) => b.date - a.date);
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

            this.groupedPayments.get(dateKey).push({
                type: 'payment',
                data: payment
            });
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

        // Объединяем все действия перед рендерингом
        this.combineAllActions();

        let content = '';

        if (this.allActions.length === 0) {
            content = this.renderEmptyState();
        } else {
            content = this.renderPaymentHistory();
        }

        container.innerHTML = Utils.wrapContent(content);
        
        // Инициализируем TGS анимации после рендеринга
        this.initializeTGSAnimations();
        
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
                    <div id="payments-empty-animation" style="width: 80px; height: 80px; margin: 0 auto;"></div>
                </div>
                <h3 class="empty-state-title">Нет платежей</h3>
                <p class="empty-state-text">
                    История ваших платежей появится здесь
                </p>
                <div class="empty-state-actions">
                    <button class="btn-subscription-purchase" onclick="window.Router.navigate('subscription')">
                        <div class="btn-purchase-bg"></div>
                        <div class="btn-purchase-content">
                            <i class="fas fa-bolt"></i>
                            <span>Оформить подписку</span>
                        </div>
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

        // Группируем все действия по дате
        const groupedByDate = new Map();
        this.allActions.forEach(action => {
            const dateKey = action.date.toISOString().split('T')[0]; // YYYY-MM-DD
            if (!groupedByDate.has(dateKey)) {
                groupedByDate.set(dateKey, []);
            }
            groupedByDate.get(dateKey).push(action);
        });

        // Сортируем группы по дате (новые сверху)
        const sortedGroups = [...groupedByDate.entries()].sort((a, b) => new Date(b[0]) - new Date(a[0]));

        for (const [dateKey, dayActions] of sortedGroups) {
            content += this.renderDateGroup(dateKey, dayActions);
        }

        return content;
    },

    /**
     * Рендеринг группы действий по дате
     */
    renderDateGroup(dateKey, actions) {
        const date = new Date(dateKey);
        const dateLabel = this.formatDateLabel(date);
        
        // Вычисляем общую сумму только для платежей
        const totalAmount = actions
            .filter(a => a.type === 'payment')
            .reduce((sum, a) => sum + (a.data.price || a.data.amount || 0), 0);

        let content = `
            <div class="payment-date-group">
                <div class="payment-date-header">
                    <h3 class="payment-date-title">${dateLabel}</h3>
                    ${totalAmount > 0 ? `
                        <div class="payment-date-total">
                            ${Utils.formatPrice(totalAmount)}
                        </div>
                    ` : ''}
                </div>
                <div class="payment-list">
        `;

        actions.forEach(action => {
            if (action.type === 'payment') {
                content += this.renderPaymentItem(action.data);
            } else if (action.type === 'currency') {
                content += this.renderCurrencyTransaction(action.data);
            } else if (action.type === 'gift') {
                content += this.renderGiftItem(action.data);
            }
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
     * Рендеринг транзакции валюты
     */
    renderCurrencyTransaction(transaction) {
        const isPositive = parseFloat(transaction.amount) > 0;
        const icon = isPositive ? 'fa-plus-circle' : 'fa-minus-circle';
        const colorClass = isPositive ? 'success' : 'warning';
        const typeText = this.getCurrencyTransactionType(transaction.transaction_type);

        return `
            <div class="payment-item currency-transaction ${colorClass}" data-transaction-id="${transaction.transaction_id || transaction.id}">
                <div class="payment-item-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="payment-item-info">
                    <div class="payment-item-service">${transaction.description || typeText}</div>
                    <div class="payment-item-meta">
                        ${Utils.formatDate(transaction.created_at, 'relative')}
                    </div>
                </div>
                <div class="payment-item-amount">
                    <div class="payment-amount ${isPositive ? 'text-green' : 'text-yellow'}">
                        ${isPositive ? '+' : ''}${transaction.amount} DRG
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Получение типа транзакции валюты
     */
    getCurrencyTransactionType(type) {
        const typeMap = {
            'daily_bonus': 'Ежедневный бонус',
            'referral_bonus': 'Реферальный бонус',
            'admin_bonus': 'Бонус от администратора',
            'purchase': 'Покупка',
            'refund': 'Возврат'
        };
        return typeMap[type] || 'Транзакция';
    },

    /**
     * Рендеринг подарка
     */
    renderGiftItem(gift) {
        const isActivated = gift.status === 'activated';
        const isPending = gift.status === 'pending';
        const statusClass = isActivated ? 'success' : (isPending ? 'pending' : 'canceled');
        const statusIcon = isActivated ? 'fa-check' : (isPending ? 'fa-clock' : 'fa-times');
        const statusText = isActivated ? 'Активирован' : (isPending ? 'Ожидает' : 'Отменен');

        return `
            <div class="payment-item gift-item ${statusClass}" data-gift-id="${gift.gift_id || gift.id}">
                <div class="payment-item-icon">
                    <i class="fas fa-gift"></i>
                </div>
                <div class="payment-item-info">
                    <div class="payment-item-service">
                        ${gift.recipient_user_id ? 'Подарок отправлен' : 'Подарок (код)'}
                    </div>
                    <div class="payment-item-meta">
                        ${gift.gift_code ? `Код: ${gift.gift_code}` : ''}
                        ${gift.activated_at ? `• Активирован ${Utils.formatDate(gift.activated_at, 'relative')}` : ''}
                        ${!gift.activated_at && gift.status === 'pending' ? '• Ожидает активации' : ''}
                    </div>
                </div>
                <div class="payment-item-amount">
                    <div class="payment-status ${statusClass}">${statusText}</div>
                </div>
            </div>
        `;
    },

    /**
     * Показ деталей платежа
     */
    async showPaymentDetails(paymentId) {
        const payment = this.payments.find(p => (p.id === paymentId) || (p.payment_id === paymentId));
        if (!payment) return;

        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }

        // ✅ ИСПРАВЛЕНИЕ: Для pending платежей сразу открываем оплату
        if (payment.status === 'pending') {
            const paymentUrl = payment.payment_url || payment.url;

            if (paymentUrl) {
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
        await this.loadCurrencyTransactions();
        await this.loadGifts();
        this.render();
    },

    /**
     * Очистка
     */
    cleanup() {
        this.payments = [];
        this.currencyTransactions = [];
        this.gifts = [];
        this.allActions = [];
        this.services.clear();
        this.groupedPayments.clear();
        this.isLoaded = false;
    }
};