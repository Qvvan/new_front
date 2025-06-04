// Subscription API for Dragon VPN Mini App

window.SubscriptionAPI = {
    /**
     * Создание новой подписки
     * @param {Object} data - Данные подписки
     * @returns {Promise<Object>} Созданная подписка
     */
    async createSubscription(data) {
        return await window.APIClient.post('/subscription', data);
    },

    /**
     * Получение подписки по ID
     * @param {string} subscriptionId - UUID подписки
     * @returns {Promise<Object>} Данные подписки
     */
    async getSubscription(subscriptionId) {
        return await window.APIClient.get(`/subscription/${subscriptionId}`);
    },

    /**
     * Обновление подписки
     * @param {string} subscriptionId - UUID подписки
     * @param {Object} data - Данные для обновления
     * @returns {Promise<Object>} Обновленная подписка
     */
    async updateSubscription(subscriptionId, data) {
        return await window.APIClient.patch(`/subscription/${subscriptionId}`, data);
    },

    /**
     * Получение списка подписок текущего пользователя
     * @param {Object} params - Параметры фильтрации
     * @returns {Promise<Object>} Список подписок
     */
    async listSubscriptions(params = {}) {
        // Автоматически добавляем user_id из Telegram
        const telegramUser = window.TelegramApp?.getUserInfo();
        if (telegramUser?.id && !params.user_id) {
            try {
                const user = await window.UserAPI.getUserByTelegramId(telegramUser.id);
                params.user_id = user.user.telegram_id; // Используем telegram_id для фильтрации
            } catch (error) {
                Utils.log('warn', 'Could not get user for subscriptions filter');
            }
        }

        return await window.APIClient.get('/subscriptions', params);
    },

    /**
     * Переключение автопродления
     * @param {string} subscriptionId - UUID подписки
     * @returns {Promise<Object>} Результат операции
     */
    async updateAutoRenewal(subscriptionId) {
        return await window.APIClient.patch(`/subscription/${subscriptionId}/auto-renewal`);
    },

    /**
     * Удаление подписки
     * @param {string} subscriptionId - UUID подписки
     * @returns {Promise<Object>} Результат удаления
     */
    async deleteSubscription(subscriptionId) {
        return await window.APIClient.delete(`/subscription/${subscriptionId}`);
    }
};