// js/api/keys.js - ИСПРАВЛЯЕМ API
window.KeysAPI = {
    /**
     * Получение ключей по подписке
     * @param {string} subscriptionId - UUID подписки
     * @returns {Promise<Object>} Список ключей
     */
    async getKeys(subscriptionId) {
        return await window.APIClient.get('/keys', {
            subscription_id: subscriptionId
        });
    },

    /**
     * Получение всех ключей пользователя
     * @returns {Promise<Object>} Все ключи со всех подписок
     */
    async getAllKeys() {
        // Получаем подписки
        const subscriptionsResponse = await window.SubscriptionAPI.listSubscriptions();
        const subscriptions = subscriptionsResponse.subscriptions || [];

        const allKeys = [];

        // Для каждой подписки получаем ключи
        for (const subscription of subscriptions) {
            try {
                const keysResponse = await this.getKeys(subscription.id);
                const keys = keysResponse.keys || [];

                // Добавляем информацию о подписке к каждому ключу
                keys.forEach(key => {
                    key.subscription = subscription;
                });

                allKeys.push(...keys);
            } catch (error) {
            }
        }

        return { keys: allKeys };
    }
};