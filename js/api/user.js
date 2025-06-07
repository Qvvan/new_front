// User API for Dragon VPN Mini App

window.UserAPI = {
    /**
     * Регистрация нового пользователя
     * @param {Object} data - Данные регистрации
     * @returns {Promise<Object>} Результат регистрации
     */
    async registerUser(referrerId = null) {
        const authData = window.TelegramApp?.getAuthData();

        const requestData = {
            init_data: authData?.initData || '',
            platform: authData?.platform || 'web',
            version: authData?.version || '1.0'
        };

        // Добавляем referrer_id если есть
        if (referrerId) {
            requestData.referrer_id = referrerId;
            Utils.log('info', `Sending referrer: ${referrerId}`);
        }

        // ✅ ИСПОЛЬЗУЕМ window.APIClient вместо callApi
        return await window.APIClient.post('/user', requestData);
    },

    /**
     * Получение пользователя по ID
     * @param {string} userId - UUID пользователя
     * @returns {Promise<Object>} Данные пользователя
     */
    async getUser(userId) {
        return await window.APIClient.get(`/user/${userId}`);
    },

    /**
     * Получение пользователя по Telegram ID
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<Object>} Данные пользователя
     */
    async getUserByTelegramId(telegramId) {
        return await window.APIClient.get(`/user/telegram/${telegramId}`);
    },

    /**
     * Обновление данных пользователя
     * @param {string} userId - UUID пользователя
     * @param {Object} userData - Данные для обновления
     * @returns {Promise<Object>} Результат обновления
     */
    async updateUser(userId, userData) {
        return await window.APIClient.put(`/user/${userId}`, userData);
    },

    /**
     * Получение текущего пользователя из Telegram
     * @returns {Promise<Object>} Данные текущего пользователя
     */
    async getCurrentUser() {
        const telegramUser = window.TelegramApp?.getUserInfo();
        if (!telegramUser?.id) {
            throw new Error('Telegram user not available');
        }

        const referrerId = window.TelegramApp?.getReferrerId();
        return await window.UserAPI.registerUser(referrerId);
    }
};