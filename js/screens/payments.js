// js/screens/payments.js
window.PaymentsScreen = {
    payments: [],
    isLoaded: false,
    isEmpty: false,

    /**
     * Инициализация экрана платежей
     */
    async init() {
        Utils.log('info', 'Initializing Payments Screen');
        await this.loadPayments();
        this.setupEventListeners();
        this.render();
        this.isLoaded = true;
    },

    /**
     * Загрузка платежей
     */
    async loadPayments() {
        try {
            if (window.Loading) {
                window.Loading.show('Загрузка платежей...');
            }

            // Загружаем все платежи пользователя
            const response = await window.PaymentAPI.listPayments({
                page: 1,
                page_size: 50
            });

            this.payments = response.payments || [];
            this.isEmpty = this.payments.length === 0;

            // Сортируем по дате создания (новые первыми)
            this.payments.sort((a, b) =>
                new Date(b.created_at) - new Date(a.created_at)
            );

            // Проверяем pending платежи и запускаем мониторинг
            await this.checkPendingPayments();

            Utils.log('info', `Loaded ${this.payments.length} payments`);

        } catch (error) {
            Utils.log('error', 'Failed to load payments:', error);
            this.isEmpty = true;
            this.payments = [];

            if (window.Toast) {
                window.Toast.error('Ошибка загрузки платежей');
            }
        } finally {
            if (window.Loading) {
                window.Loading.hide();
            }
        }
    },

    /**
     * Проверка pending платежей и запуск мониторинга
     */
    async checkPendingPayments() {
        const pendingPayments = this.payments.filter(p => p.status === 'pending');

        if (pendingPayments.length > 0) {
            Utils.log('info', `Found ${pendingPayments.length} pending payments, starting monitor`);

            // Показываем banner для последнего pending платежа
            const latestPending = pendingPayments[0];
            if (window.PaymentBanner && !window.PaymentBanner.isShowing()) {
                window.PaymentBanner.show(latestPending);
            }

            // Запускаем мониторинг если не запущен
            if (window.PaymentMonitor && !window.PaymentMonitor.isRunning) {
                // Добавляем все pending платежи в мониторинг
                pendingPayments.forEach(payment => {
                    window.PaymentMonitor.addPayment(payment.id);
                });

                // Запускаем с интервалом 7 секунд
                window.PaymentMonitor.checkIntervalMs = 7000;
                await window.PaymentMonitor.start();
            }
        } else {
            Utils.log('info', 'No pending payments found');

            // Останавливаем мониторинг если нет pending платежей
            if (window.PaymentMonitor && window.PaymentMonitor.isRunning) {
                window.PaymentMonitor.stop();
            }
        }
    },

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Слушаем успешные платежи
        document.addEventListener('paymentSuccess', async (e) => {
            const { paymentId } = e.detail;
            Utils.log('info', `Payment success received for: ${paymentId}`);

            // Обновляем статус в локальном списке
            const payment = this.payments.find(p => p.id === paymentId);
            if (payment) {
                payment.status = 'succeeded';
                this.render(); // Перерисовываем экран
            }

            // Проверяем остались ли pending платежи
            await this.checkPendingPayments();
        });

        // Слушаем отмененные платежи
        document.addEventListener('paymentCancelled', async (e) => {
            const { paymentId } = e.detail;
            Utils.log('info', `Payment cancelled for: ${paymentId}`);

            const payment = this.payments.find(p => p.id === paymentId);
            if (payment) {
                payment.status = 'canceled';
                this.render();
            }

            await this.checkPendingPayments();
        });

        // Обработка кликов по платежам
        document.addEventListener('click', (e) => {
            const paymentsScreen = e.target.closest('#paymentsScreen');
            if (!paymentsScreen) return;

            const paymentCard = e.target.closest('[data-payment-id]');
            if (paymentCard) {
                const paymentId = paymentCard.dataset.paymentId;
                this.handlePaymentClick(paymentId);
            }
        });
    },

    /**
     * Обработка клика по платежу
     */
    handlePaymentClick(paymentId) {
        const payment = this.payments.find(p => p.id === paymentId);
        if (!payment) return;

        // Если платеж pending - показываем banner
        if (payment.status === 'pending') {
            if (window.PaymentBanner) {
                window.PaymentBanner.show(payment);
            }
        }

        // Вибрация
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }
    },

    /**
     * Рендеринг экрана
     */
    render() {
        const container = document.getElementById('paymentsScreen');
        if (!container) return;

        let content = '';

        if (this.isEmpty) {
            content = this.renderEmptyState();
        } else {
            content = this.renderPaymentsList();
        }

        container.innerHTML = Utils.wrapContent(content);
        this.animateElements();
    },

    /**
     * Рендеринг пустого состояния
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-credit-card"></i>
                </div>
                <h3 class="empty-state-title">История платежей пуста</h3>
                <p class="empty-state-text">
                    Здесь будут отображаться ваши платежи за подписки
                </p>
                <div class="empty-state-actions">
                    <button class="btn btn-primary btn-full" onclick="window.Router?.navigate('subscription')">
                        <i class="fas fa-shopping-cart"></i>
                        Оформить подписку
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг списка платежей
     */
    renderPaymentsList() {
        const groupedPayments = this.groupPaymentsByDate();

        return `
            <div class="section">
                <h2 class="section-title">
                    <img src="${window.Assets.getGif('management.gif')}" alt="Management" class="section-title-gif" />
                    История платежей
                </h2>
                <div class="payments-list">
                    ${Object.entries(groupedPayments).map(([date, payments]) => `
                        <div class="payments-group">
                            <div class="payments-group-date">${date}</div>
                            ${payments.map(payment => this.renderPaymentCard(payment)).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Группировка платежей по датам
     */
    groupPaymentsByDate() {
        const groups = {};

        this.payments.forEach(payment => {
            const date = Utils.formatDate(payment.created_at, 'long');
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(payment);
        });

        return groups;
    },

    /**
     * Рендеринг карточки платежа
     */
    renderPaymentCard(payment) {
        const statusClass = this.getPaymentStatusClass(payment.status);
        const statusText = this.getPaymentStatusText(payment.status);
        const statusIcon = this.getPaymentStatusIcon(payment.status);

        return `
            <div class="payment-card ${statusClass}" data-payment-id="${payment.id}">
                <div class="payment-card-content">
                    <div class="payment-info">
                        <div class="payment-icon">
                            <i class="${statusIcon}"></i>
                        </div>
                        <div class="payment-details">
                            <h4 class="payment-title">${this.getPaymentTitle(payment)}</h4>
                            <p class="payment-description">${payment.description || 'Оплата подписки'}</p>
                            <div class="payment-meta">
                                <span class="payment-time">${Utils.formatDate(payment.created_at, 'relative')}</span>
                                ${payment.receipt_link ? '<span class="payment-receipt">Чек доступен</span>' : ''}
                            </div>
                        </div>
                    </div>
                    <div class="payment-amount">
                        <div class="payment-price">${this.formatPaymentAmount(payment)}</div>
                        <div class="payment-status ${statusClass}">${statusText}</div>
                    </div>
                </div>
                ${payment.status === 'pending' ? `
                    <div class="payment-card-actions">
                        <div class="payment-pending-info">
                            <i class="fas fa-clock"></i>
                            <span>Ожидает оплаты</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Получение заголовка платежа
     */
    getPaymentTitle(payment) {
        // Пытаемся извлечь название из описания или используем общее
        if (payment.description) {
            const parts = payment.description.split(' - ');
            return parts[0] || 'Подписка Dragon VPN';
        }
        return 'Подписка Dragon VPN';
    },

    /**
     * Форматирование суммы платежа
     */
    formatPaymentAmount(payment) {
        // Пытаемся найти сумму в разных полях
        const amount = payment.amount || payment.value || payment.price || 0;
        return Utils.formatPrice(amount, 'RUB');
    },

    /**
     * Получение CSS класса для статуса
     */
    getPaymentStatusClass(status) {
        const statusMap = {
            'pending': 'pending',
            'succeeded': 'success',
            'canceled': 'cancelled',
            'waiting_for_capture': 'pending'
        };
        return statusMap[status] || 'unknown';
    },

    /**
     * Получение текста статуса
     */
    getPaymentStatusText(status) {
        const statusMap = {
            'pending': 'Ожидает',
            'succeeded': 'Успешно',
            'canceled': 'Отменен',
            'waiting_for_capture': 'Обработка'
        };
        return statusMap[status] || 'Неизвестно';
    },

    /**
     * Получение иконки статуса
     */
    getPaymentStatusIcon(status) {
        const iconMap = {
            'pending': 'fas fa-clock',
            'succeeded': 'fas fa-check-circle',
            'canceled': 'fas fa-times-circle',
            'waiting_for_capture': 'fas fa-hourglass-half'
        };
        return iconMap[status] || 'fas fa-question-circle';
    },

    /**
     * Анимация элементов
     */
    animateElements() {
        const elements = document.querySelectorAll('#paymentsScreen .payment-card');
        elements.forEach((el, index) => {
            el.classList.add('stagger-item');
            el.style.animationDelay = `${index * 0.1}s`;
        });
    },

    /**
     * Обновление данных
     */
    async refresh() {
        await this.loadPayments();
        this.render();
    },

    /**
     * Очистка
     */
    cleanup() {
        this.payments = [];
        this.isLoaded = false;
        this.isEmpty = false;

        const container = document.getElementById('paymentsScreen');
        if (container) {
            container.innerHTML = '';
        }
    }
};