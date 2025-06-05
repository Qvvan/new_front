// Payment Monitor Service
window.PaymentMonitor = {
    monitoringInterval: null,
    pendingPayments: new Map(),
    isActive: false,
    checkInterval: 8000, // 8 секунд

    /**
     * Добавить платеж в мониторинг
     */
    addPayment(paymentId) {
        if (!paymentId) return;

        // ✅ Добавляем дополнительные флаги для отслеживания
        this.pendingPayments.set(paymentId, {
            id: paymentId,
            addedAt: Date.now(),
            lastChecked: null,
            wasSuccessful: false, // ⭐ Новый флаг!
            checkCount: 0         // ⭐ Счетчик проверок
        });

        Utils.log('info', `Added payment ${paymentId} to monitoring`);
        this.start();
    },

    /**
     * Удалить платеж из мониторинга
     */
    removePayment(paymentId) {
        if (this.pendingPayments.has(paymentId)) {
            this.pendingPayments.delete(paymentId);
            Utils.log('info', `Removed payment from monitoring: ${paymentId}`);

            // Если нет pending платежей - останавливаем мониторинг
            if (this.pendingPayments.size === 0) {
                this.stop();
            }
        }
    },

    /**
     * Запуск мониторинга
     */
    start() {
        if (this.isActive || this.pendingPayments.size === 0) return;

        this.isActive = true;
        Utils.log('info', 'Payment monitoring started');

        this.monitoringInterval = setInterval(() => {
            this.checkPaymentStatuses();
        }, this.checkInterval);

        // Проверяем сразу
        this.checkPaymentStatuses();
    },

    /**
     * Остановка мониторинга
     */
    stop() {
        if (!this.isActive) return;

        this.isActive = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        Utils.log('info', 'Payment monitoring stopped');
    },

    /**
     * Проверка статусов платежей
     */
    async checkPaymentStatuses() {
        if (this.pendingPayments.size === 0) {
            this.stop();
            return;
        }

        // ✅ Защита от слишком частых проверок одного платежа
        const maxChecks = 120; // Максимум 120 проверок (10 минут при интервале 5 сек)

        try {
            const response = await window.PaymentAPI.listPayments({
                status: 'pending,succeeded,canceled'
            });
            const payments = response.payments || [];

            for (const [paymentId, info] of this.pendingPayments.entries()) {
                // ⚠️ Увеличиваем счетчик проверок
                info.checkCount = (info.checkCount || 0) + 1;

                // ⚠️ Если слишком много проверок - удаляем платеж
                if (info.checkCount > maxChecks) {
                    Utils.log('warn', `Payment ${paymentId} exceeded max checks, removing`);
                    this.removePayment(paymentId);
                    continue;
                }

                const payment = payments.find(p => p.id === paymentId || p.payment_id === paymentId);

                if (payment) {
                    await this.handlePaymentStatusChange(payment, info);
                } else {
                    Utils.log('info', `Payment ${paymentId} not found in API, removing from monitoring`);
                    this.removePayment(paymentId);
                }
            }

        } catch (error) {
            Utils.log('error', 'Failed to check payment statuses:', error);
        }
    },

    /**
     * Обработка изменения статуса платежа
     */
    async handlePaymentStatusChange(payment, info) {
        const currentStatus = payment.status;
        const paymentId = payment.id;

        Utils.log('info', `Payment ${paymentId} status: ${currentStatus}`);

        if (currentStatus === 'succeeded') {
            // ✅ Проверяем, что это действительно новый успешный платеж
            if (!info.wasSuccessful) {
                info.wasSuccessful = true; // Помечаем как обработанный
                await this.handlePaymentSuccess(payment);
            }
            this.removePayment(paymentId);

        } else if (currentStatus === 'canceled') {
            Utils.log('info', `Payment ${paymentId} was canceled`);
            await this.handlePaymentCanceled(payment);
            this.removePayment(paymentId);

        } else if (currentStatus === 'pending') {
            // Остается pending - обновляем время последней проверки
            info.lastChecked = Date.now();
            Utils.log('debug', `Payment ${paymentId} still pending`);
        } else {
            // Неизвестный статус - удаляем из мониторинга
            Utils.log('warn', `Payment ${paymentId} has unknown status: ${currentStatus}`);
            this.removePayment(paymentId);
        }
    },

    /**
     * Обработка успешного платежа
     */
    async handlePaymentSuccess(payment) {
        Utils.log('info', 'Payment succeeded:', payment.id);

        // Скрываем баннер
        if (window.PaymentBanner) {
            window.PaymentBanner.hide();
        }

        // Показываем успешную анимацию
        await this.showPaymentSuccessAnimation(payment);

        // Обновляем данные подписок
        if (window.SubscriptionScreen && window.SubscriptionScreen.isLoaded) {
            await window.SubscriptionScreen.refresh();
        }

        // Показываем инструкции
        setTimeout(() => {
            if (window.InstructionsScreen) {
                window.InstructionsScreen.show();
            }
        }, 1000);

        // Вибрация успеха
        if (window.TelegramApp) {
            window.TelegramApp.haptic.success();
        }
    },

    /**
     * Обработка отмененного платежа
     */
    async handlePaymentCanceled(payment) {
        Utils.log('info', 'Payment canceled:', payment.id);

        // Скрываем баннер если это последний pending
        if (this.pendingPayments.size <= 1 && window.PaymentBanner) {
            window.PaymentBanner.hide();
        }

        // Показываем уведомление
        if (window.Toast) {
            window.Toast.warning('Платеж отменен');
        }
    },

    /**
     * Анимация успешного платежа
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
                        Спасибо за покупку ${Utils.formatPrice(payment.price || 0)}
                    </p>
                </div>
            `);

            document.body.appendChild(animation);

            setTimeout(() => {
                animation.classList.add('active');
            }, 100);

            setTimeout(() => {
                animation.classList.remove('active');
                setTimeout(() => {
                    animation.remove();
                    resolve();
                }, 500);
            }, 3000);
        });
    },

    /**
     * Получение pending платежей
     */
    getPendingPayments() {
        return Array.from(this.pendingPayments.keys());
    },

    /**
     * Проверка активности мониторинга
     */
    isMonitoring() {
        return this.isActive;
    },

    /**
     * Очистка мониторинга
     */
    cleanup() {
        this.stop();
        this.pendingPayments.clear();
    }
};