// Referral API for Dragon VPN Mini App

window.ReferralAPI = {
    /**
     * Получение списка рефералов
     * @param {Object} params - Параметры фильтрации
     * @returns {Promise<Object>} Список рефералов
     */
    async listReferrals(params = {}) {
        return await window.APIClient.get('/referrals', params);
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
        const telegramUser = window.TelegramApp?.getUserInfo();
        if (!telegramUser?.id) {
            throw new Error('User not available');
        }

        return await window.APIClient.get('/referrals', {
            referrer_id: telegramUser.id
        });
    },

    /**
     * Генерация реферальной ссылки
     * @returns {Promise<string>} Реферальная ссылка
     */
    async generateReferralLink() {
        const telegramUser = window.TelegramApp?.getUserInfo();
        if (!telegramUser?.id) {
            throw new Error('User not available');
        }

        // Генерируем ссылку с Telegram bot URL
        const botUsername = 'dragonvpn_bot'; // Замените на ваш бот
        const startParam = `ref_${telegramUser.id}`;

        return `https://t.me/${botUsername}?start=${startParam}`;
    }
};// Referral API for Dragon VPN Mini App

window.ReferralAPI = {
    /**
     * Получение списка рефералов
     * @param {Object} params - Параметры фильтрации
     * @returns {Promise<Object>} Список рефералов
     */
    async listReferrals(params = {}) {
        return await window.APIClient.get('/referrals', params);
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
        const telegramUser = window.TelegramApp?.getUserInfo();
        if (!telegramUser?.id) {
            throw new Error('User not available');
        }

        return await window.APIClient.get('/referrals', {
            referrer_id: telegramUser.id
        });
    },

    /**
     * Генерация реферальной ссылки
     * @returns {Promise<string>} Реферальная ссылка
     */
    async generateReferralLink() {
        const telegramUser = window.TelegramApp?.getUserInfo();
        if (!telegramUser?.id) {
            throw new Error('User not available');
        }

        // Генерируем ссылку с Telegram bot URL
        const botUsername = 'skydragonvpnbot'; // Замените на ваш бот
        const startParam = `${telegramUser.id}`;

        return `https://t.me/${botUsername}?start=${startParam}`;
    }
};