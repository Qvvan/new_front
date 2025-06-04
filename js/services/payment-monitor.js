// Payment Monitor Service for Dragon VPN Mini App

window.PaymentMonitor = {
    isRunning: false,
    interval: null,
    checkIntervalMs: 5000, // 5 секунд
    monitoredPayments: new Set(),
    maxRetries: 3,
    retryCount: new Map(),

    /**
     * Запуск мониторинга
     */
    async start() {
        if (this.isRunning) {
            Utils.log('warn', 'Payment monitor already running');
            return;
        }

        Utils.log('info', 'Starting payment monitor');

        // Загружаем pending платежи
        await this.loadPendingPayments();

        if (this.monitoredPayments.size === 0) {
            Utils.log('info', 'No pending payments to monitor');
            return;
        }

        this.isRunning = true;
        this.interval = setInterval(() => {
            this.checkPayments();
        }, this.checkIntervalMs);

        Utils.log('info', `Payment monitor started, checking ${this.monitoredPayments.size} payments`);
    },

    /**
     * Остановка мониторинга
     */
    stop() {
        if (!this.isRunning) return;

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        this.isRunning = false;
        this.monitoredPayments.clear();
        this.retryCount.clear();

        Utils.log('info', 'Payment monitor stopped');
    },

    /**
     * Загрузка pending платежей из Storage
     */
    async loadPendingPayments() {
        try {
            const pendingPayments = await window.Storage?.getPendingPayments() || [];

            pendingPayments.forEach(payment => {
                if (payment.id && payment.status === 'pending') {
                    this.monitoredPayments.add(payment.id);
                    this.retryCount.set(payment.id, 0);
                }
            });

            Utils.log('info', `Loaded ${pendingPayments.length} pending payments for monitoring`);
        } catch (error) {
            Utils.log('error', 'Failed to load pending payments:', error);
        }
    },

    /**
     * Добавление платежа в мониторинг
     */
    addPayment(paymentId) {
        if (!paymentId) return;

        this.monitoredPayments.add(paymentId);
        this.retryCount.set(paymentId, 0);

        // Запускаем мониторинг если еще не запущен
        if (!this.isRunning) {
            this.start();
        }

        Utils.log('info', `Payment ${paymentId} added to monitoring`);
    },

    /**
     * Удаление платежа из мониторинга
     */
    removePayment(paymentId) {
        this.monitoredPayments.delete(paymentId);
        this.retryCount.delete(paymentId);

        // Останавливаем мониторинг если нет платежей
        if (this.monitoredPayments.size === 0) {
            this.stop();
        }

        Utils.log('info', `Payment ${paymentId} removed from monitoring`);
    },

    /**
     * Проверка всех платежей
     */
    async checkPayments() {
        if (this.monitoredPayments.size === 0) {
            this.stop();
            return;
        }

        const promises = Array.from(this.monitoredPayments).map(paymentId =>
            this.checkSinglePayment(paymentId)
        );

        await Promise.allSettled(promises);
    },

    /**
     * Проверка одного платежа
     */
    async checkSinglePayment(paymentId) {
        try {
            const response = await window.PaymentAPI.getPayment(paymentId);
            const payment = response.payment;

            if (!payment) {
                Utils.log('warn', `Payment ${paymentId} not found`);
                this.removePayment(paymentId);
                return;
            }

            await this.handlePaymentStatusChange(payment);

        } catch (error) {
            await this.handlePaymentError(paymentId, error);
        }
    },

    /**
     * Обработка изменения статуса платежа
     */
    async handlePaymentStatusChange(payment) {
        const { id, status } = payment;

        Utils.log('debug', `Payment ${id} status: ${status}`);

        switch (status) {
            case 'succeeded':
                await this.handlePaymentSuccess(payment);
                break;

            case 'canceled':
                await this.handlePaymentCancellation(payment);
                break;

            case 'waiting_for_capture':
                // Продолжаем мониторинг
                break;

            case 'pending':
                // Проверяем не истек ли срок
                await this.checkPaymentExpiry(payment);
                break;

            default:
                Utils.log('warn', `Unknown payment status: ${status} for payment ${id}`);
        }
    },

    /**
     * Успешная оплата
     */
    async handlePaymentSuccess(payment) {
        Utils.log('info', `Payment ${payment.id} succeeded!`);

        // Убираем из мониторинга
        this.removePayment(payment.id);

        // Убираем из pending в Storage
        if (window.Storage) {
            await window.Storage.removePendingPayment(payment.id);
        }

        // Скрываем payment banner
        if (window.PaymentBanner && window.PaymentBanner.getCurrentPayment()?.id === payment.id) {
            window.PaymentBanner.hide();
        }

        // Показываем анимацию успеха
        await this.showPaymentSuccessAnimation(payment);

        // Обновляем данные подписок
        await this.refreshUserData();

        // Показываем инструкции если это первая покупка
        await this.showInstructionsIfNeeded(payment);

        // Эмитируем событие
        document.dispatchEvent(new CustomEvent('paymentSuccess', {
            detail: { paymentId: payment.id, payment }
        }));
    },

    /**
     * Отмена платежа
     */
    async handlePaymentCancellation(payment) {
        Utils.log('info', `Payment ${payment.id} was cancelled`);

        // Убираем из мониторинга
        this.removePayment(payment.id);

        // Убираем из pending в Storage
        if (window.Storage) {
            await window.Storage.removePendingPayment(payment.id);
        }

        // Скрываем payment banner
        if (window.PaymentBanner && window.PaymentBanner.getCurrentPayment()?.id === payment.id) {
            window.PaymentBanner.hide();
        }

        // Показываем уведомление
        if (window.Toast) {
            window.Toast.warning('Платеж был отменен');
        }

        // Эмитируем событие
        document.dispatchEvent(new CustomEvent('paymentCancelled', {
            detail: { paymentId: payment.id, payment }
        }));
    },

    /**
     * Проверка истечения срока платежа
     */
    async checkPaymentExpiry(payment) {
        // Проверяем expires_at если есть
        if (payment.expires_at) {
            const expiryTime = new Date(payment.expires_at);
            const now = new Date();

            if (now > expiryTime) {
                Utils.log('info', `Payment ${payment.id} expired`);
                await this.handlePaymentCancellation(payment);
            }
        }
    },

    /**
     * Обработка ошибки запроса
     */
    async handlePaymentError(paymentId, error) {
        const currentRetries = this.retryCount.get(paymentId) || 0;

        if (currentRetries >= this.maxRetries) {
            Utils.log('error', `Max retries reached for payment ${paymentId}, removing from monitoring`);
            this.removePayment(paymentId);
            return;
        }

        this.retryCount.set(paymentId, currentRetries + 1);
        Utils.log('warn', `Payment check failed for ${paymentId}, retry ${currentRetries + 1}/${this.maxRetries}:`, error);
    },

    /**
     * Анимация успешной оплаты
     */
    async showPaymentSuccessAnimation(payment) {
        return new Promise((resolve) => {
            const animation = Utils.createElement('div', {
                className: 'payment-success'
            }, `
                <div class="payment-success-content">
                    <div class="payment-success-icon">
                        <i class="fas fa-check"></i>
                    </div>
                    <h2 class="payment-success-title">Оплата прошла успешно!</h2>
                    <p class="payment-success-text">
                        Ваша подписка активирована.<br>
                        Теперь вы можете получить VPN ключи.
                    </p>
                </div>
            `);

            document.body.appendChild(animation);

            // Показываем анимацию
            setTimeout(() => {
                animation.classList.add('active');
            }, 100);

            // Вибрация успеха
            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

            // Скрываем через 4 секунды
            setTimeout(() => {
                animation.classList.remove('active');
                setTimeout(() => {
                    animation.remove();
                    resolve();
                }, 500);
            }, 4000);
        });
    },

    /**
     * Обновление данных пользователя после успешной оплаты
     */
    async refreshUserData() {
        try {
            // Обновляем подписки
            if (window.SubscriptionScreen && window.SubscriptionScreen.isLoaded) {
                await window.SubscriptionScreen.refresh();
            }

            // Обновляем навигацию
            if (window.Navigation) {
                await window.Navigation.updateNavigationState();
            }

            Utils.log('info', 'User data refreshed after payment success');
        } catch (error) {
            Utils.log('error', 'Failed to refresh user data:', error);
        }
    },

    /**
     * Показ инструкций для новых пользователей
     */
    async showInstructionsIfNeeded(payment) {
        try {
            // Проверяем, первая ли это покупка
            const userData = await window.Storage?.getUserData();
            const isFirstPurchase = !userData?.has_active_subscription;

            if (isFirstPurchase) {
                // Задержка перед показом инструкций
                setTimeout(() => {
                    if (window.Router) {
                        window.Router.navigate('instructions');
                    }
                }, 2000);
            }
        } catch (error) {
            Utils.log('error', 'Failed to check if instructions needed:', error);
        }
    },

    /**
     * Получение статуса мониторинга
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            monitoredPayments: Array.from(this.monitoredPayments),
            checkInterval: this.checkIntervalMs,
            retryCount: Object.fromEntries(this.retryCount)
        };
    },

    /**
     * Принудительная проверка всех платежей
     */
    async forceCheck() {
        if (this.monitoredPayments.size === 0) {
            Utils.log('info', 'No payments to check');
            return;
        }

        Utils.log('info', 'Force checking all payments');
        await this.checkPayments();
    }
};