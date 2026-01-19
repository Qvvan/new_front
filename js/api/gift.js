// Gift API for Dragon VPN Mini App

window.GiftAPI = {
    /**
     * Создание подарка
     * @param {Object} data - Данные подарка (service_id, recipient_user_id?, message?, sender_display_name?)
     * @returns {Promise<Object>} Результат создания подарка с payment данными
     */
    async createGift(data) {
        return await window.APIClient.post('/subscription/gifts', data);
    },

    /**
     * Получение подарка по ID
     * @param {number} giftId - ID подарка
     * @returns {Promise<Object>} Данные подарка
     */
    async getGift(giftId) {
        return await window.APIClient.get(`/subscription/gifts/${giftId}`);
    },

    /**
     * Получение подарка по коду
     * @param {string} giftCode - Код подарка
     * @returns {Promise<Object>} Данные подарка
     */
    async getGiftByCode(giftCode) {
        return await window.APIClient.get(`/subscription/gifts/code/${giftCode}`);
    },

    /**
     * Получение ожидающих подарков пользователя
     * @param {number} userId - ID пользователя
     * @returns {Promise<Array>} Список ожидающих подарков
     */
    async getPendingGifts(userId) {
        try {
            const response = await window.APIClient.get(`/subscription/gifts/user/${userId}/pending`);
            return Array.isArray(response) ? response : (response.gifts || []);
        } catch (error) {
            // Если эндпоинт не найден, возвращаем пустой массив
            
            return [];
        }
    },

    /**
     * Получение отправленных подарков пользователя
     * @param {number} userId - ID пользователя
     * @returns {Promise<Array>} Список отправленных подарков
     */
    async getSentGifts(userId) {
        return await window.APIClient.get(`/subscription/gifts/user/${userId}/sent`);
    },

    /**
     * Активация подарка по ID
     * @param {number} giftId - ID подарка
     * @returns {Promise<Object>} Активированный подарок
     */
    async activateGift(giftId) {
        return await window.APIClient.post(`/subscription/gifts/${giftId}/activate`);
    },

    /**
     * Активация подарка по коду
     * @param {string} giftCode - Код подарка
     * @returns {Promise<Object>} Активированный подарок
     */
    async activateGiftByCode(giftCode) {
        return await window.APIClient.post('/subscription/gifts/activate/code', {
            gift_code: giftCode
        });
    },


    /**
     * Возврат средств за неактивированный подарок
     * @param {number} giftId - ID подарка
     * @returns {Promise<Object>} Результат возврата
     */
    async refundGift(giftId) {
        // Возврат через платежную систему
        return await window.APIClient.post(`/subscription/gifts/${giftId}/refund`);
    }
};
