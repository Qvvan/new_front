// js/api/referral.js
window.ReferralAPI = {
    /**
     * Получение списка рефералов пользователя
     * @param {Object} params - Параметры фильтрации
     * @returns {Promise<Object>} Список рефералов
     */
    async listReferrals() {
        return await window.APIClient.get('/user/referral/me');
    },

    /**
     * Создание новой реферальной записи
     * @param {Object} data - Данные реферала
     * @returns {Promise<Object>} Созданный реферал
     */
    async createReferral(data) {
        return await window.APIClient.post('/referral', data);
    },

    /**
     * Получение статистики рефералов пользователя
     * @param {number} userId - ID пользователя
     * @returns {Promise<Object>} Статистика рефералов
     */
    async getReferralStats() {
        return await window.APIClient.get('/user/referral/me');
    },

    /**
     * Генерация реферальной ссылки
     * @returns {Promise<Object>} Реферальная ссылка и код
     */
    async generateReferralLink() {
        const telegramUser = window.TelegramApp?.getUserInfo();
        if (!telegramUser?.id) {
            throw new Error('Telegram user not available');
        }

        // Получаем username бота (нужно будет настроить в конфиге)
        const botUsername = window.Config?.BOT_USERNAME || 'SuperSummaryBot';
        const userId = telegramUser.id.toString();

        return {
            code: userId,
            link: `https://t.me/${botUsername}/sky?startapp=${userId}`,
            shortCode: userId
        };
    }
};