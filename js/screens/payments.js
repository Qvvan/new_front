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
        // Удаляем старые обработчики если есть
        if (this._clickHandler) {
            document.removeEventListener('click', this._clickHandler);
        }

        // Создаем новый обработчик с привязкой контекста
        this._clickHandler = (e) => {
            try {
                const paymentsScreen = e.target.closest('#paymentsScreen');
                if (!paymentsScreen) return;

                const paymentItem = e.target.closest('.payment-item');
                if (!paymentItem) return;

                // Предотвращаем множественные клики
                if (paymentItem.hasAttribute('data-processing')) {
                    return;
                }
                paymentItem.setAttribute('data-processing', 'true');
                setTimeout(() => {
                    paymentItem.removeAttribute('data-processing');
                }, 500);

                // Обработка клика по платежу
                if (paymentItem.dataset.paymentId) {
                    const paymentId = paymentItem.dataset.paymentId;
                    if (paymentId) {
                        this.showPaymentDetails(paymentId);
                    }
                } 
                // Обработка клика по подарку
                else if (paymentItem.dataset.giftId) {
                    const giftId = paymentItem.dataset.giftId;
                    if (giftId) {
                        this.showGiftDetails(giftId);
                    }
                } 
                // Обработка клика по транзакции
                else if (paymentItem.dataset.transactionId) {
                    const transactionId = paymentItem.dataset.transactionId;
                    if (transactionId) {
                        this.showTransactionDetails(transactionId);
                    }
                }
            } catch (error) {
                Utils.log('error', 'Error in payment item click handler:', error);
                if (window.Toast) {
                    window.Toast.error('Ошибка при открытии деталей');
                }
            }
        };

        document.addEventListener('click', this._clickHandler);
    },

    /**
     * Показ деталей подарка
     * @param {string|number} giftId - ID подарка
     */
    async showGiftDetails(giftId) {
        try {
            if (!giftId) {
                Utils.log('warn', 'showGiftDetails called without giftId');
                return;
            }

            const gift = this.gifts.find(g => {
                const gId = g.gift_id || g.id;
                return gId && gId.toString() === giftId.toString();
            });

            if (!gift) {
                Utils.log('warn', 'Gift not found:', giftId);
                if (window.Toast) {
                    window.Toast.warning('Подарок не найден');
                }
                return;
            }

            if (!window.Modal) {
                Utils.log('error', 'Modal component not available');
                if (window.Toast) {
                    window.Toast.error('Модальное окно недоступно');
                }
                return;
            }

            if (window.TelegramApp && window.TelegramApp.haptic) {
                window.TelegramApp.haptic.light();
            }

            const status = gift.status || 'unknown';
            const statusText = status === 'activated' ? 'Активирован' : 
                              status === 'pending' ? 'Ожидает активации' : 
                              status === 'canceled' ? 'Отменен' : 'Неизвестно';
            const canRefund = status === 'pending' && !gift.activated_at && gift.gift_code;
            const createdAt = gift.created_at ? Utils.formatDate(gift.created_at, 'long') : 'Неизвестно';
            const activatedAt = gift.activated_at ? Utils.formatDate(gift.activated_at, 'long') : null;

            window.Modal.show({
                title: 'Детали подарка',
                content: `
                    <div class="payment-details">
                        <div class="payment-detail-item">
                            <span class="detail-label">Статус</span>
                            <span class="detail-value payment-status ${status}">
                                ${this.escapeHtml(statusText)}
                            </span>
                        </div>
                        ${gift.gift_code ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">Код активации</span>
                                <span class="detail-value">${this.escapeHtml(gift.gift_code)}</span>
                            </div>
                        ` : ''}
                        ${gift.recipient_user_id ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">Получатель</span>
                                <span class="detail-value">ID: ${gift.recipient_user_id}</span>
                            </div>
                        ` : ''}
                        ${activatedAt ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">Активирован</span>
                                <span class="detail-value">${activatedAt}</span>
                            </div>
                        ` : ''}
                        <div class="payment-detail-item">
                            <span class="detail-label">Дата создания</span>
                            <span class="detail-value">${createdAt}</span>
                        </div>
                    </div>
                `,
                buttons: [
                    ...(canRefund ? [{
                        id: 'refund',
                        text: 'Запросить возврат',
                        type: 'warning',
                        handler: async () => {
                            try {
                                await this.handleGiftRefund(gift);
                                if (window.Modal) {
                                    window.Modal.hide();
                                }
                            } catch (error) {
                                Utils.log('error', 'Error handling gift refund:', error);
                            }
                        }
                    }] : []),
                    {
                        id: 'close',
                        text: 'Закрыть',
                        action: 'close'
                    }
                ]
            });

        } catch (error) {
            Utils.log('error', 'Error showing gift details:', error);
            if (window.Toast) {
                window.Toast.error('Ошибка при открытии деталей подарка');
            }
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
     * @param {string|number} transactionId - ID транзакции
     */
    async showTransactionDetails(transactionId) {
        try {
            if (!transactionId) {
                Utils.log('warn', 'showTransactionDetails called without transactionId');
                return;
            }

            const transaction = this.currencyTransactions.find(t => {
                const tId = t.transaction_id || t.id;
                return tId && tId.toString() === transactionId.toString();
            });

            if (!transaction) {
                Utils.log('warn', 'Transaction not found:', transactionId);
                if (window.Toast) {
                    window.Toast.warning('Транзакция не найдена');
                }
                return;
            }

            if (!window.Modal) {
                Utils.log('error', 'Modal component not available');
                if (window.Toast) {
                    window.Toast.error('Модальное окно недоступно');
                }
                return;
            }

            if (window.TelegramApp && window.TelegramApp.haptic) {
                window.TelegramApp.haptic.light();
            }

            const isDailyBonus = transaction.transaction_type === 'daily_bonus';
            const transactionType = this.getCurrencyTransactionType(transaction.transaction_type);
            
            // Для ежедневного бонуса показываем расширенную информацию
            if (isDailyBonus) {
                const claimedAt = transaction.created_at ? Utils.formatDate(transaction.created_at, 'long') : 'Неизвестно';
                const balanceBefore = transaction.balance_before !== undefined && transaction.balance_before !== null
                    ? transaction.balance_before
                    : (transaction.balance_after !== undefined && transaction.amount !== undefined
                        ? (parseFloat(transaction.balance_after) - parseFloat(transaction.amount))
                        : 0);
                const balanceAfter = transaction.balance_after || 0;
                const bonusAmount = transaction.amount || 0;

                window.Modal.show({
                    title: 'Ежедневный бонус',
                    content: `
                        <div class="payment-details">
                            <div class="payment-detail-item">
                                <span class="detail-label">Тип</span>
                                <span class="detail-value">${this.escapeHtml(transactionType)}</span>
                            </div>
                            <div class="payment-detail-item">
                                <span class="detail-label">Получено</span>
                                <span class="detail-value text-green">+${bonusAmount} DRG</span>
                            </div>
                            <div class="payment-detail-item">
                                <span class="detail-label">Баланс до</span>
                                <span class="detail-value">${balanceBefore} DRG</span>
                            </div>
                            <div class="payment-detail-item">
                                <span class="detail-label">Баланс после</span>
                                <span class="detail-value text-green">${balanceAfter} DRG</span>
                            </div>
                            <div class="payment-detail-item">
                                <span class="detail-label">Время получения</span>
                                <span class="detail-value">${claimedAt}</span>
                            </div>
                            ${transaction.description ? `
                                <div class="payment-detail-item">
                                    <span class="detail-label">Описание</span>
                                    <span class="detail-value">${this.escapeHtml(transaction.description)}</span>
                                </div>
                            ` : ''}
                        </div>
                    `,
                    buttons: [{
                        id: 'close',
                        text: 'Закрыть',
                        action: 'close'
                    }]
                });
            } else {
                // Для других типов транзакций показываем стандартную информацию
                const amount = parseFloat(transaction.amount || 0);
                const isPositive = amount > 0;
                const balanceBefore = transaction.balance_before !== undefined && transaction.balance_before !== null
                    ? transaction.balance_before
                    : null;
                const balanceAfter = transaction.balance_after || 0;
                const createdAt = transaction.created_at ? Utils.formatDate(transaction.created_at, 'long') : 'Неизвестно';

                window.Modal.show({
                    title: 'Детали транзакции',
                    content: `
                        <div class="payment-details">
                            <div class="payment-detail-item">
                                <span class="detail-label">Тип</span>
                                <span class="detail-value">${this.escapeHtml(transaction.description || transactionType)}</span>
                            </div>
                            <div class="payment-detail-item">
                                <span class="detail-label">Сумма</span>
                                <span class="detail-value ${isPositive ? 'text-green' : 'text-yellow'}">
                                    ${isPositive ? '+' : ''}${amount} DRG
                                </span>
                            </div>
                            ${balanceBefore !== null ? `
                                <div class="payment-detail-item">
                                    <span class="detail-label">Баланс до</span>
                                    <span class="detail-value">${balanceBefore} DRG</span>
                                </div>
                            ` : ''}
                            <div class="payment-detail-item">
                                <span class="detail-label">Баланс после</span>
                                <span class="detail-value">${balanceAfter} DRG</span>
                            </div>
                            <div class="payment-detail-item">
                                <span class="detail-label">Дата</span>
                                <span class="detail-value">${createdAt}</span>
                            </div>
                            ${transaction.description ? `
                                <div class="payment-detail-item">
                                    <span class="detail-label">Описание</span>
                                    <span class="detail-value">${this.escapeHtml(transaction.description)}</span>
                                </div>
                            ` : ''}
                        </div>
                    `,
                    buttons: [{
                        id: 'close',
                        text: 'Закрыть',
                        action: 'close'
                    }]
                });
            }

        } catch (error) {
            Utils.log('error', 'Error showing transaction details:', error);
            if (window.Toast) {
                window.Toast.error('Ошибка при открытии деталей транзакции');
            }
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
            // Сохраняем и по service_id, и по id для совместимости
            this.services.clear();
            servicesList.forEach(service => {
                const serviceId = service.service_id || service.id;
                if (serviceId) {
                    this.services.set(serviceId, service);
                }
                // Также сохраняем по id если он отличается от service_id
                if (service.id && service.id !== serviceId) {
                    this.services.set(service.id, service);
                }
            });
            
            Utils.log('info', `Loaded ${this.services.size} services for payments`);
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
            if (!payment.service_id) {
                Utils.log('warn', 'Payment has no service_id:', payment);
                // Пытаемся извлечь данные из описания
                this.enrichPaymentFromDescription(payment);
                return;
            }

            // Пытаемся найти сервис по service_id
            let service = this.services.get(payment.service_id);
            
            // Если не нашли, пробуем найти по id (на случай если ключи не совпадают)
            if (!service && payment.service_id) {
                // Пробуем все возможные варианты ключей
                for (const [key, svc] of this.services.entries()) {
                    if ((svc.service_id && svc.service_id.toString() === payment.service_id.toString()) ||
                        (svc.id && svc.id.toString() === payment.service_id.toString())) {
                        service = svc;
                        break;
                    }
                }
            }

            if (service) {
                // Добавляем данные сервиса к платежу
                payment.service_name = service.name || payment.service_name;
                payment.service_price = service.price || payment.service_price || payment.price;
                payment.service_duration_days = service.duration_days;
                payment.service_duration = this.formatDuration(service.duration_days);

                // Если в платеже нет цены, берем из сервиса
                if (!payment.price || payment.price === 0) {
                    payment.price = service.price || payment.amount || 0;
                }
                
                Utils.log('info', `Enriched payment ${payment.payment_id || payment.id} with service: ${service.name}`);
            } else {
                // Fallback: пытаемся извлечь данные из описания
                Utils.log('warn', `Service not found for payment ${payment.payment_id || payment.id}, service_id: ${payment.service_id}`);
                this.enrichPaymentFromDescription(payment);
            }
        });
    },

    /**
     * Обогащение платежа данными из описания (fallback)
     */
    enrichPaymentFromDescription(payment) {
        if (!payment.description) {
            payment.service_name = payment.service_name || 'VPN подписка';
            payment.service_duration = payment.service_duration || 'Неизвестно';
            return;
        }

        const desc = payment.description;
        
        // Пытаемся извлечь название услуги
        // Паттерны: "Название - описание", "Название для пользователя", "Название 1 месяц"
        let serviceName = null;
        
        // Паттерн 1: "Название - описание"
        const dashMatch = desc.match(/^([^-]+?)(?:\s*-\s*)/);
        if (dashMatch) {
            serviceName = dashMatch[1].trim();
        }
        
        // Паттерн 2: "Название для пользователя" или "Название подписки X месяц"
        if (!serviceName) {
            const forMatch = desc.match(/^(.+?)(?:\s+для\s+|\s+подписк[иаеы]\s+\d+)/);
            if (forMatch) {
                serviceName = forMatch[1].trim();
            }
        }
        
        // Паттерн 3: "Название X месяц/день/год"
        if (!serviceName) {
            const periodMatch = desc.match(/^(.+?)(?:\s+\d+\s*(?:месяц|мес|день|дн|год))/i);
            if (periodMatch) {
                serviceName = periodMatch[1].trim();
            }
        }
        
        // Паттерн 4: Берем все до первого числа
        if (!serviceName) {
            const beforeNumberMatch = desc.match(/^([^\d]+?)(?:\s+\d+)/);
            if (beforeNumberMatch) {
                serviceName = beforeNumberMatch[1].trim();
            }
        }
        
        // Если нашли название, используем его
        if (serviceName && serviceName.length > 0) {
            payment.service_name = serviceName;
        } else {
            // Fallback: берем первые слова
            const words = desc.split(' ');
            if (words.length > 0) {
                payment.service_name = words.slice(0, Math.min(3, words.length)).join(' ').trim();
            } else {
                payment.service_name = payment.service_name || 'VPN подписка';
            }
        }

        // Пытаемся извлечь период из описания
        // Паттерны: "1 месяц", "30 дней", "1 год", "подписки 1 месяц"
        const periodPatterns = [
            /(\d+)\s*(месяц|месяца|месяцев|мес)/i,
            /(\d+)\s*(день|дня|дней|дн)/i,
            /(\d+)\s*(год|года|лет)/i,
            /подписк[иаеы]\s+(\d+)\s*(месяц|мес)/i,
            /(\d+)\s*мес/i
        ];

        let periodFound = false;
        for (const pattern of periodPatterns) {
            const match = desc.match(pattern);
            if (match) {
                const amount = parseInt(match[1] || match[2]);
                const unit = (match[2] || match[3] || '').toLowerCase();
                
                if (unit.includes('год') || desc.toLowerCase().includes('год')) {
                    payment.service_duration = `${amount} ${Utils.pluralize(amount, ['год', 'года', 'лет'])}`;
                } else if (unit.includes('мес') || desc.toLowerCase().includes('месяц')) {
                    payment.service_duration = `${amount} ${Utils.pluralize(amount, ['месяц', 'месяца', 'месяцев'])}`;
                } else if (unit.includes('дн') || desc.toLowerCase().includes('день')) {
                    payment.service_duration = `${amount} ${Utils.pluralize(amount, ['день', 'дня', 'дней'])}`;
                } else {
                    // Если единица не определена, но есть число - предполагаем месяцы
                    payment.service_duration = `${amount} ${Utils.pluralize(amount, ['месяц', 'месяца', 'месяцев'])}`;
                }
                periodFound = true;
                break;
            }
        }

        if (!periodFound) {
            // Если не нашли период явно, но есть число - пытаемся угадать
            const numberMatch = desc.match(/(\d+)/);
            if (numberMatch && !payment.service_duration) {
                const num = parseInt(numberMatch[1]);
                // Если число маленькое (1-12), скорее всего это месяцы
                if (num >= 1 && num <= 12) {
                    payment.service_duration = `${num} ${Utils.pluralize(num, ['месяц', 'месяца', 'месяцев'])}`;
                } else if (num <= 31) {
                    payment.service_duration = `${num} ${Utils.pluralize(num, ['день', 'дня', 'дней'])}`;
                } else if (num <= 365) {
                    payment.service_duration = `${Math.round(num / 30)} ${Utils.pluralize(Math.round(num / 30), ['месяц', 'месяца', 'месяцев'])}`;
                } else {
                    payment.service_duration = `${Math.round(num / 365)} ${Utils.pluralize(Math.round(num / 365), ['год', 'года', 'лет'])}`;
                }
            } else {
                payment.service_duration = payment.service_duration || 'Неизвестно';
            }
        }

        // Пытаемся извлечь цену из описания
        if (!payment.price || payment.price === 0) {
            payment.price = this.extractPriceFromDescription(desc) || payment.amount || 0;
        }
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

        const paymentId = payment.payment_id || payment.id;
        return `
            <div class="payment-item ${statusClass}" data-payment-id="${paymentId}">
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
     * @param {string|number} paymentId - ID платежа
     */
    async showPaymentDetails(paymentId) {
        try {
            if (!paymentId) {
                Utils.log('warn', 'showPaymentDetails called without paymentId');
                return;
            }

            const payment = this.payments.find(p => {
                const pId = p.id || p.payment_id;
                const pPaymentId = p.payment_id || p.id;
                return (pId && pId.toString() === paymentId.toString()) || 
                       (pPaymentId && pPaymentId.toString() === paymentId.toString());
            });

            if (!payment) {
                Utils.log('warn', 'Payment not found:', paymentId);
                if (window.Toast) {
                    window.Toast.warning('Платеж не найден');
                }
                return;
            }

            if (window.TelegramApp && window.TelegramApp.haptic) {
                window.TelegramApp.haptic.light();
            }

            // Всегда показываем модальное окно с деталями
            this.showPaymentModal(payment);

        } catch (error) {
            Utils.log('error', 'Error showing payment details:', error);
            if (window.Toast) {
                window.Toast.error('Ошибка при открытии деталей платежа');
            }
        }
    },

    /**
     * Модальное окно с деталями платежа
     * @param {Object} payment - Объект платежа
     */
    showPaymentModal(payment) {
        try {
            if (!payment) {
                Utils.log('error', 'showPaymentModal called without payment');
                return;
            }

            if (!window.Modal) {
                Utils.log('error', 'Modal component not available');
                if (window.Toast) {
                    window.Toast.error('Модальное окно недоступно');
                }
                return;
            }

            const isPending = payment.status === 'pending';
            const isSuccess = payment.status === 'succeeded';
            const isCanceled = payment.status === 'canceled';

            const statusText = isPending ? 'Ожидает оплаты' :
                              isSuccess ? 'Успешно оплачено' :
                              isCanceled ? 'Отменено' : 'Неизвестно';

            const statusClass = isPending ? 'pending' : isSuccess ? 'success' : isCanceled ? 'canceled' : 'unknown';

            // Безопасное получение данных - если данных нет, пытаемся обогатить
            if (!payment.service_name || payment.service_name === 'VPN подписка' || 
                !payment.service_duration || payment.service_duration === 'Неизвестно') {
                
                // Пытаемся найти сервис в кеше
                if (payment.service_id && this.services.size > 0) {
                    let service = this.services.get(payment.service_id);
                    
                    // Если не нашли, пробуем найти по всем ключам
                    if (!service) {
                        for (const [key, svc] of this.services.entries()) {
                            if ((svc.service_id && svc.service_id.toString() === payment.service_id.toString()) ||
                                (svc.id && svc.id.toString() === payment.service_id.toString())) {
                                service = svc;
                                break;
                            }
                        }
                    }
                    
                    if (service) {
                        payment.service_name = service.name;
                        payment.service_duration = this.formatDuration(service.duration_days);
                        payment.service_price = service.price;
                        Utils.log('info', `Enriched payment ${payment.payment_id || payment.id} with service: ${service.name}`);
                    } else {
                        // Пытаемся извлечь из описания
                        this.enrichPaymentFromDescription(payment);
                    }
                } else if (payment.description) {
                    // Извлекаем из описания
                    this.enrichPaymentFromDescription(payment);
                }
            }

            const serviceName = payment.service_name || payment.description?.split(' - ')[0] || 'VPN подписка';
            const serviceDuration = payment.service_duration || 'Неизвестно';
            const servicePrice = payment.service_price || payment.price || 0;
            const actualPrice = payment.price || payment.amount || 0;
            const hasDiscount = servicePrice > actualPrice && actualPrice > 0 && servicePrice !== actualPrice;

            // Безопасное форматирование payment_id
            const formatPaymentId = (id) => {
                if (!id) return null;
                const idStr = typeof id === 'string' ? id : String(id);
                return idStr.length > 16 ? `${idStr.substring(0, 16)}...` : idStr;
            };

            const paymentId = formatPaymentId(payment.payment_id || payment.id);
            const createdAt = payment.created_at ? Utils.formatDate(payment.created_at, 'long') : 'Неизвестно';
            const updatedAt = payment.updated_at ? Utils.formatDate(payment.updated_at, 'long') : null;

            window.Modal.show({
                title: 'Детали платежа',
                content: `
                    <div class="payment-details">
                        ${paymentId ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">ID платежа</span>
                                <span class="detail-value payment-id">${paymentId}</span>
                            </div>
                        ` : ''}
                        <div class="payment-detail-item">
                            <span class="detail-label">Услуга</span>
                            <span class="detail-value">${this.escapeHtml(serviceName)}</span>
                        </div>
                        <div class="payment-detail-item">
                            <span class="detail-label">Период</span>
                            <span class="detail-value">${this.escapeHtml(serviceDuration)}</span>
                        </div>
                        <div class="payment-detail-item">
                            <span class="detail-label">Статус</span>
                            <span class="detail-value payment-status ${statusClass}">
                                ${this.escapeHtml(statusText)}
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
                            <span class="detail-value">${createdAt}</span>
                        </div>
                        ${updatedAt && updatedAt !== createdAt ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">Последнее обновление</span>
                                <span class="detail-value">${updatedAt}</span>
                            </div>
                        ` : ''}
                        ${payment.description ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">Описание</span>
                                <span class="detail-value">${this.escapeHtml(payment.description)}</span>
                            </div>
                        ` : ''}
                    </div>
                `,
                buttons: [
                    ...(isPending ? [{
                        id: 'continue',
                        text: 'Продолжить оплату',
                        type: 'primary',
                        handler: async () => {
                            try {
                                const paymentUrl = payment.confirmation_url || 
                                                  payment.payment_url || 
                                                  payment.url || 
                                                  payment.receipt_link;

                                if (!paymentUrl) {
                                    // Пытаемся найти в Storage
                                    const pendingPayments = await window.Storage?.getPendingPayments() || [];
                                    const storedPayment = pendingPayments.find(p =>
                                        (p.id && p.id.toString() === (payment.id || payment.payment_id)?.toString()) ||
                                        (p.payment_id && p.payment_id.toString() === (payment.payment_id || payment.id)?.toString())
                                    );

                                    if (storedPayment && storedPayment.payment_url) {
                                        if (window.TelegramApp && window.TelegramApp.openLink) {
                                            window.TelegramApp.openLink(storedPayment.payment_url);
                                        } else {
                                            window.open(storedPayment.payment_url, '_blank');
                                        }
                                        if (window.Modal) {
                                            window.Modal.hide();
                                        }
                                        return;
                                    }
                                }

                                if (paymentUrl) {
                                    if (window.TelegramApp && window.TelegramApp.openLink) {
                                        window.TelegramApp.openLink(paymentUrl);
                                    } else {
                                        window.open(paymentUrl, '_blank');
                                    }
                                    if (window.Modal) {
                                        window.Modal.hide();
                                    }
                                } else {
                                    if (window.Toast) {
                                        window.Toast.warning('Ссылка на оплату недоступна');
                                    }
                                }
                            } catch (error) {
                                Utils.log('error', 'Error continuing payment:', error);
                                if (window.Toast) {
                                    window.Toast.error('Ошибка при открытии оплаты');
                                }
                            }
                        }
                    }] : []),
                    ...(isSuccess ? [{
                        id: 'receipt',
                        text: 'Перейти к чеку',
                        type: 'primary',
                        handler: async () => {
                            try {
                                // Используем confirmation_url для успешных платежей (это и есть чек)
                                let receiptUrl = payment.receipt_link || 
                                               payment.confirmation_url || 
                                               payment.payment_url || 
                                               payment.url;

                                // Если URL нет, пытаемся найти в Storage
                                if (!receiptUrl) {
                                    const pendingPayments = await window.Storage?.getPendingPayments() || [];
                                    const storedPayment = pendingPayments.find(p =>
                                        (p.id && p.id.toString() === (payment.id || payment.payment_id)?.toString()) ||
                                        (p.payment_id && p.payment_id.toString() === (payment.payment_id || payment.id)?.toString())
                                    );
                                    if (storedPayment) {
                                        receiptUrl = storedPayment.receipt_link || 
                                                   storedPayment.confirmation_url || 
                                                   storedPayment.payment_url || 
                                                   storedPayment.url;
                                    }
                                }

                                if (receiptUrl) {
                                    if (window.TelegramApp && window.TelegramApp.openLink) {
                                        window.TelegramApp.openLink(receiptUrl);
                                    } else {
                                        window.open(receiptUrl, '_blank');
                                    }
                                    if (window.Modal) {
                                        window.Modal.hide();
                                    }
                                } else {
                                    if (window.Toast) {
                                        window.Toast.warning('Ссылка на чек недоступна');
                                    }
                                }
                            } catch (error) {
                                Utils.log('error', 'Error opening receipt:', error);
                                if (window.Toast) {
                                    window.Toast.error('Ошибка при открытии чека');
                                }
                            }
                        }
                    }] : []),
                    {
                        id: 'close',
                        text: 'Закрыть',
                        action: 'close'
                    }
                ]
            });

        } catch (error) {
            Utils.log('error', 'Error showing payment modal:', error);
            if (window.Toast) {
                window.Toast.error('Ошибка при открытии деталей платежа');
            }
        }
    },

    /**
     * Экранирование HTML для безопасности
     * @param {string} text - Текст для экранирования
     * @returns {string} Экранированный текст
     */
    escapeHtml(text) {
        if (typeof text !== 'string') {
            return String(text || '');
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        // Удаляем обработчики событий
        if (this._clickHandler) {
            document.removeEventListener('click', this._clickHandler);
            this._clickHandler = null;
        }

        // Очищаем данные
        this.payments = [];
        this.currencyTransactions = [];
        this.gifts = [];
        this.allActions = [];
        this.services.clear();
        this.groupedPayments.clear();
        this.isLoaded = false;
    }
};