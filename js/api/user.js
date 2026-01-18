// User API for Dragon VPN Mini App

window.UserAPI = {
    /**
     * Создание или получение пользователя (регистрация)
     * @param {number} referrerId - ID реферера (опционально)
     * @returns {Promise<Object>} Данные пользователя
     */
    async registerUser(referrerId = null) {
        const requestData = {};
        if (referrerId) {
            requestData.referrer_id = referrerId;
        }

        return await window.APIClient.post('/user', requestData);
    },

    /**
     * Получение текущего пользователя из Telegram контекста
     * @returns {Promise<Object>} Данные текущего пользователя
     */
    async getCurrentUser() {
        return await window.APIClient.get('/user/user/me');
    },

    /**
     * Обновление текущего пользователя
     * @param {Object} userData - Данные для обновления
     * @returns {Promise<Object>} Обновленные данные пользователя
     */
    async updateCurrentUser(userData) {
        return await window.APIClient.put('/user/user/me', userData);
    },

    /**
     * Получение пользователя по Telegram ID
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<Object>} Данные пользователя
     */
    async getUserByTelegramId(telegramId) {
        return await window.APIClient.get(`/user/${telegramId}`);
    },

    /**
     * Обновление данных пользователя по Telegram ID
     * @param {number} telegramId - Telegram user ID
     * @param {Object} userData - Данные для обновления
     * @returns {Promise<Object>} Результат обновления
     */
    async updateUser(telegramId, userData) {
        return await window.APIClient.put(`/user/${telegramId}`, userData);
    },

    /**
     * Обновление времени последнего входа текущего пользователя
     * @returns {Promise<void>}
     */
    async updateLastSeen() {
        return await window.APIClient.post('/user/user/me/last-seen');
    },

    /**
     * Блокировка пользователя (админ функция)
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<Object>} Данные пользователя
     */
    async banUser(telegramId) {
        return await window.APIClient.post(`/user/${telegramId}/ban`);
    },

    /**
     * Разблокировка пользователя (админ функция)
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<Object>} Данные пользователя
     */
    async unbanUser(telegramId) {
        return await window.APIClient.post(`/user/${telegramId}/unban`);
    },

    /**
     * Активация пробного периода для пользователя (админ функция)
     * @param {number} telegramId - Telegram user ID
     * @returns {Promise<Object>} Данные пользователя
     */
    async activateTrialForUser(telegramId) {
        return await window.APIClient.post(`/user/${telegramId}/activate-trial`);
    }
};