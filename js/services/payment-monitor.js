// Payment Monitor Service
window.PaymentMonitor = {
    pendingPayments: new Map(),
    processedSuccessfulPayments: new Set(),
    isActive: false,
    checkInterval: 8000,

    /**
     * Добавить платеж в мониторинг
     */
    addPayment(paymentId) {
        if (!paymentId) return;

        // ✅ Проверяем что платеж еще не был успешно обработан
        if (this.processedSuccessfulPayments.has(paymentId)) {
            return;
        }

        this.pendingPayments.set(paymentId, {
            id: paymentId,
            addedAt: Date.now(),
            lastChecked: null,
            checkCount: 0
        });

        this.start();
    },

    /**
     * Удалить платеж из мониторинга
     */
    removePayment(paymentId) {
        if (this.pendingPayments.has(paymentId)) {
            this.pendingPayments.delete(paymentId);

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
    },

    /**
     * Проверка статусов платежей
     */
    async checkPaymentStatuses() {
        if (this.pendingPayments.size === 0) {
            this.stop();
            return;
        }

        // ✅ ОПТИМИЗАЦИЯ: Не проверяем если страница не видна
        if (document.hidden) {
            return;
        }

        // ✅ Защита от слишком частых проверок одного платежа
        const maxChecks = 120; // Максимум 120 проверок (10 минут при интервале 5 сек)

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
                return;
            }

            const response = await window.PaymentAPI.listPayments(userId, { limit: 50, offset: 0 });
            const payments = response.payments || [];

            for (const [paymentId, info] of this.pendingPayments.entries()) {
                // ⚠️ Увеличиваем счетчик проверок
                info.checkCount = (info.checkCount || 0) + 1;

                // ⚠️ Если слишком много проверок - удаляем платеж
                if (info.checkCount > maxChecks) {
                    this.removePayment(paymentId);
                    continue;
                }

                const payment = payments.find(p => p.id === paymentId || p.payment_id === paymentId);

                if (payment) {
                    await this.handlePaymentStatusChange(payment, info);
                } else {
                    this.removePayment(paymentId);
                }
            }

        } catch (error) {
        }
    },

    /**
     * Обработка изменения статуса платежа
     */
    async handlePaymentStatusChange(payment, info) {
        const currentStatus = payment.status;
        const paymentId = payment.payment_id || payment.id;

        if (currentStatus === 'succeeded') {
            if (!info.wasSuccessful) {
                info.wasSuccessful = true; // Помечаем как обработанный
                await this.handlePaymentSuccess(payment);
            }
            this.removePayment(paymentId);

        } else if (currentStatus === 'canceled') {
            await this.handlePaymentCanceled(payment);
            this.removePayment(paymentId);

        } else if (currentStatus === 'pending') {
            // Остается pending - обновляем время последней проверки
            info.lastChecked = Date.now();
        } else {
            this.removePayment(paymentId);
        }
    },

    /**
     * Обработка успешного платежа
     */
    async handlePaymentSuccess(payment) {
        const paymentId = payment.id;

        // ✅ Проверяем что этот платеж еще не обрабатывался
        if (this.processedSuccessfulPayments.has(paymentId)) {
            return;
        }

        await this.enrichPaymentWithServiceData(payment);

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
        this.processedSuccessfulPayments.clear();
        this.pendingPayments.clear();
    }
};