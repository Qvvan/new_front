// js/api/referral.js
window.ReferralAPI = {
    /**
     * Получение списка рефералов пользователя
     * @param {Object} params - Параметры фильтрации
     * @returns {Promise<Object>} Список рефералов
     */
    async listReferrals(params = {}) {
        return await window.APIClient.get('/referrals', params);
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
    async getReferralStats(userId) {
        return await window.APIClient.get(`/user/${userId}/referrals`);
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

        // Генерируем реферальный код
        const referralCode = `ref_${telegramUser.id}_${Date.now().toString(36)}`;

        // Получаем username бота (нужно будет настроить в конфиге)
        const botUsername = window.Config?.BOT_USERNAME || 'SkyDragonVPNBot';

        return {
            code: referralCode,
            link: `https://t.me/${botUsername}?startapp=${referralCode}`,
            shortCode: referralCode.split('_')[1] // Для отображения
        };
    }
};