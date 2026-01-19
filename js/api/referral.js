// Referral API for Dragon VPN Mini App

window.ReferralAPI = {
    /**
     * Получение списка рефералов текущего пользователя
     * @returns {Promise<Object>} Список рефералов
     */
    async listReferrals() {
        return await window.APIClient.get('/user/referral/me');
    },

    /**
     * Получение рефералов пользователя
     * @param {number} userId - ID пользователя
     * @returns {Promise<Object>} Рефералы пользователя
     */
    async getUserReferrals(userId) {
        return await window.APIClient.get(`/user/${userId}/referrals`);
    },

    /**
     * Создание реферальной связи
     * @param {Object} data - Данные реферала
     * @returns {Promise<Object>} Созданная связь
     */
    async createReferral(data) {
        return await window.APIClient.post('/referral', data);
    },

    /**
     * Получение реферальной статистики
     * @returns {Promise<Object>} Статистика
     */
    async getReferralStats() {
        // Используем тот же эндпоинт, что и listReferrals
        return await window.APIClient.get('/user/referral/me');
    },

    /**
     * Генерация реферальной ссылки
     * @returns {Promise<Object>} Объект с реферальной ссылкой и кодом
     */
    async generateReferralLink() {
        const telegramUser = window.TelegramApp?.getUserInfo();
        if (!telegramUser?.id) {
            throw new Error('User not available');
        }

        // Генерируем ссылку с Telegram bot URL
        const botUsername = 'skydragonvpnbot';
        const startParam = `${telegramUser.id}`;
        const link = `https://t.me/${botUsername}?start=${startParam}`;

        return {
            link: link,
            shortCode: telegramUser.id.toString()
        };
    }
};
