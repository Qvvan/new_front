// Payment API for Dragon VPN Mini App

window.PaymentAPI = {
    /**
     * Создание нового платежа (для подписки, продления или подарка)
     * @param {Object} data - Данные платежа (service_id обязателен для subscription/renewal)
     * @param {number} userId - ID пользователя (берется из query параметра)
     * @returns {Promise<Object>} Результат создания платежа с confirmation_url
     */
    async createPayment(data, userId = null) {
        const params = {};
        if (userId) {
            params.user_id = userId;
        }

        const endpoint = '/payments';
        if (params.user_id) {
            endpoint += `?user_id=${params.user_id}`;
        }

        return await window.APIClient.post(endpoint, data);
    },

    /**
     * Создание платежа за новую подписку
     * @param {Object} data - Данные платежа (service_id)
     * @param {number} userId - ID пользователя
     * @returns {Promise<Object>} Результат создания платежа
     */
    async createSubscriptionPayment(data, userId) {
        const endpoint = `/subscription/subscriptions/payment?user_id=${userId}`;
        return await window.APIClient.post(endpoint, data);
    },

    /**
     * Создание платежа за продление подписки
     * @param {Object} data - Данные платежа (subscription_id, service_id)
     * @param {number} userId - ID пользователя
     * @returns {Promise<Object>} Результат создания платежа
     */
    async createRenewalPayment(data, userId) {
        const endpoint = `/subscription/subscriptions/renewal/payment?user_id=${userId}`;
        return await window.APIClient.post(endpoint, data);
    },

    /**
     * Создание платежа за подарок
     * @param {Object} data - Данные платежа (service_id, gift_id опционально)
     * @returns {Promise<Object>} Результат создания платежа
     */
    async createGiftPayment(data) {
        const paymentData = {
            payment_type: 'gift',
            ...data
        };
        return await this.createPayment(paymentData);
    },

    /**
     * Получение платежа по ID
     * @param {number} paymentId - ID платежа
     * @returns {Promise<Object>} Данные платежа
     */
    async getPayment(paymentId) {
        return await window.APIClient.get(`/payments/${paymentId}`);
    },

    /**
     * Получение платежа по YooKassa payment ID
     * @param {string} yookassaPaymentId - ID платежа в YooKassa
     * @returns {Promise<Object>} Данные платежа
     */
    async getPaymentByYookassaId(yookassaPaymentId) {
        return await window.APIClient.get(`/payments/yookassa/${yookassaPaymentId}`);
    },

    /**
     * Получение истории платежей пользователя
     * @param {number} userId - ID пользователя
     * @param {Object} params - Параметры (limit, offset)
     * @returns {Promise<Object>} Список платежей с total
     */
    async listPayments(userId, params = {}) {
        const queryParams = { ...params };
        return await window.APIClient.get(`/payments/user/${userId}`, queryParams);
    },

    /**
     * Получение pending платежей пользователя
     * @param {number} userId - ID пользователя
     * @returns {Promise<Array>} Список pending платежей
     */
    async getPendingPayments(userId) {
        try {
            const response = await window.APIClient.get(`/payments/user/${userId}/pending`);
            return response.payments || [];
        } catch (error) {
            Utils.log('warn', 'Pending payments endpoint not available:', error);
            return [];
        }
    },


    /**
     * Возврат средств за платеж
     * @param {number} paymentId - ID платежа
     * @param {number} amount - Сумма возврата (если null, возвращается полная сумма)
     * @returns {Promise<Object>} Обновленный платеж
     */
    async refundPayment(paymentId, amount = null) {
        const params = {};
        if (amount !== null) {
            params.amount = amount;
        }

        const endpoint = `/payments/${paymentId}/refund`;
        if (Object.keys(params).length > 0) {
            const queryString = new URLSearchParams(params).toString();
            return await window.APIClient.post(`${endpoint}?${queryString}`);
        }

        return await window.APIClient.post(endpoint);
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
            throw error;
        }
    }
};