// Subscription API for Dragon VPN Mini App

window.SubscriptionAPI = {
    /**
     * Получение списка подписок текущего пользователя
     * @returns {Promise<Array>} Список подписок
     */
    async listSubscriptions() {
        return await window.APIClient.get('/subscription/subscriptions/user');
    },

    /**
     * Получение подписки по ID
     * @param {number} subscriptionId - ID подписки
     * @returns {Promise<Object>} Данные подписки
     */
    async getSubscription(subscriptionId) {
        return await window.APIClient.get(`/subscriptions/${subscriptionId}`);
    },

    /**
     * Получение статуса подписки пользователя по user_id
     * @param {number} userId - ID пользователя
     * @returns {Promise<Object>} Статус подписки
     */
    async getUserSubscriptionStatus(userId) {
        return await window.APIClient.get(`/subscriptions/user/${userId}/status`);
    },

    /**
     * Активация пробного периода
     * @returns {Promise<Object>} Созданная пробная подписка
     */
    async activateTrial() {
        return await window.APIClient.post('/user/user/trial');
    },

    /**
     * Переключение автопродления
     * @param {number} subscriptionId - ID подписки
     * @param {boolean} autoRenewal - Включить/выключить автопродление
     * @returns {Promise<Object>} Результат операции
     */
    async updateAutoRenewal(subscriptionId, autoRenewal) {
        const url = `/subscription/subscriptions/${subscriptionId}/auto-renewal?auto_renewal=${autoRenewal}`;
        return await window.APIClient.post(url);
    },

    /**
     * Отмена подписки
     * @param {number} subscriptionId - ID подписки
     * @param {string} reason - Причина отмены
     * @returns {Promise<Object>} Результат отмены
     */
    async cancelSubscription(subscriptionId, reason = null) {
        return await window.APIClient.post(`/subscriptions/${subscriptionId}/cancel`, { reason });
    },

    /**
     * Получение истории подписки
     * @param {number} subscriptionId - ID подписки
     * @returns {Promise<Array>} История подписки
     */
    async getSubscriptionHistory(subscriptionId) {
        return await window.APIClient.get(`/subscriptions/${subscriptionId}/history`);
    },

    /**
     * Получение истории пользователя
     * @param {number} userId - ID пользователя
     * @param {Object} params - Параметры (limit, offset)
     * @returns {Promise<Array>} История пользователя
     */
    async getUserHistory(userId, params = {}) {
        return await window.APIClient.get(`/subscription/subscriptions/user/${userId}/history`, params);
    }
};