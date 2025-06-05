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
    async listPayments(params = {}) {
        // Убираем добавление user_id в параметры
        return await window.APIClient.get('/payments', params);
    },

    /**
     * Получение pending платежей пользователя
     * @returns {Promise<Array>} Список pending платежей
     */
    async getPendingPayments() {
        try {
            const response = await this.listPayments({ status: 'pending' });
            const payments = response.payments || [];

            // Обогащаем каждый платеж данными сервиса
            for (const payment of payments) {
                try {
                    const service = await window.ServiceAPI.getService(payment.service_id);
                    if (service) {
                        payment.service_name = service.name;
                        payment.service_duration_days = service.duration_days;
                    }
                } catch (error) {
                    // Игнорируем ошибки получения сервиса для отдельных платежей
                    Utils.log('warn', `Could not load service ${payment.service_id}:`, error);
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
                // Сохраняем в pending платежи
                if (window.Storage) {
                    await window.Storage.addPendingPayment({
                        ...payment,
                        payment_url: response.url // URL для оплаты
                    });
                }

                // Добавляем в мониторинг
                if (window.PaymentMonitor) {
                    window.PaymentMonitor.addPayment(payment.id);
                }
            }

            return response;
        } catch (error) {
            Utils.log('error', 'Failed to create payment with monitoring:', error);
            throw error;
        }
    }
};