// Payment API for Dragon VPN Mini App

window.PaymentAPI = {
    /**
     * Создание нового платежа
     * @param {Object} data - Данные платежа
     * @returns {Promise<Object>} Результат создания платежа
     */
    async createPayment(data) {
        // Автоматически добавляем user_id из Telegram
        const telegramUser = window.TelegramApp?.getUserInfo();
        if (telegramUser?.id && !data.user_id) {
            try {
                const user = await window.UserAPI.getUserByTelegramId(telegramUser.id);
                data.user_id = user.user.telegram_id;
            } catch (error) {
                Utils.log('error', 'Could not get user_id for payment');
                throw new Error('Пользователь не найден');
            }
        }

        return await window.APIClient.post('/payment', data);
    },

    /**
     * Получение платежа по ID
     * @param {string} paymentId - UUID платежа
     * @returns {Promise<Object>} Данные платежа
     */
    async getPayment(paymentId) {
        return await window.APIClient.get(`/payment/${paymentId}`);
    },

    /**
     * Обновление платежа
     * @param {string} paymentId - UUID платежа
     * @param {Object} paymentData - Данные для обновления
     * @returns {Promise<Object>} Обновленный платеж
     */
    async updatePayment(paymentId, paymentData) {
        return await window.APIClient.put(`/payment/${paymentId}`, { payment: paymentData });
    },

    /**
     * Получение истории платежей пользователя
     * @param {Object} params - Параметры фильтрации
     * @returns {Promise<Object>} Список платежей
     */
    async listPayments() {
        // Убираем добавление user_id в параметры
        return await window.APIClient.get('/payments');
    },

    /**
     * Получение pending платежей пользователя
     * @returns {Promise<Array>} Список pending платежей
     */
    async getPendingPayments() {
        try {
            // ✅ Получаем только реально pending платежи
            const response = await this.listPayments({
                status: 'pending',
                // Добавляем ограничение по времени - только за последние 24 часа
                created_since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            });

            const payments = response.payments || [];

            Utils.log('info', `API returned ${payments.length} pending payments`);

            // Обогащаем данными сервисов только если есть платежи
            if (payments.length > 0) {
                for (const payment of payments) {
                    try {
                        const service = await window.ServiceAPI.getService(payment.service_id);
                        if (service && service.service) {
                            payment.service_name = service.service.name;
                            payment.service_duration_days = service.service.duration_days;
                        }
                    } catch (error) {
                        Utils.log('warn', `Could not load service ${payment.service_id}:`, error);
                    }
                }
            }

            return payments;
        } catch (error) {
            Utils.log('error', 'Failed to get pending payments:', error);
            return [];
        }
    },

    /**
     * Создание платежа с автоматическим мониторингом
     */
    async createPaymentWithMonitoring(data) {
        try {
            const response = await this.createPayment(data);
            const payment = response.payment || response;

            if (payment.id && payment.status === 'pending') {
                // ✅ ИСПРАВЛЕНИЕ: Правильно передаем URL
                const paymentWithUrl = {
                    ...payment,
                    payment_url: response.url || response.confirmation_url, // URL из ответа API
                    url: response.url // Дублируем для совместимости
                };

                // Сохраняем в pending платежи
                if (window.Storage) {
                    await window.Storage.addPendingPayment(paymentWithUrl);
                }

                // Добавляем в мониторинг
                if (window.PaymentMonitor) {
                    window.PaymentMonitor.addPayment(payment.id);
                }

                // ✅ Возвращаем объединенные данные
                return {
                    ...response,
                    payment: paymentWithUrl
                };
            }

            return response;
        } catch (error) {
            Utils.log('error', 'Failed to create payment with monitoring:', error);
            throw error;
        }
    }
};