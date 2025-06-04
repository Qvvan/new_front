// User API for Dragon VPN Mini App

window.UserAPI = {
    /**
     * Регистрация нового пользователя
     * @param {Object} data - Данные регистрации
     * @returns {Promise<Object>} Результат регистрации
     */
    async registerUser(data = {}) {
        return await window.APIClient.post('/user', data);
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

        try {
            return await this.getUserByTelegramId(telegramUser.id);
        } catch (error) {
            // Если пользователь не найден, создаем нового
            if (error.status === 404) {
                Utils.log('info', 'User not found, creating new user');
                return await this.registerUser();
            }
            throw error;
        }
    }
};