// Currency API for Dragon VPN Mini App

window.CurrencyAPI = {
    /**
     * Получение баланса валюты (Dragon Coins) текущего пользователя
     * @returns {Promise<Object>} Баланс валюты
     */
    async getBalance() {
        return await window.APIClient.get('/currency/balance');
    },

    /**
     * Получение истории транзакций валюты текущего пользователя
     * @param {Object} params - Параметры (limit, offset)
     * @returns {Promise<Object>} История транзакций с total, limit, offset
     */
    async getTransactions(params = {}) {
        return await window.APIClient.get('/currency/transactions', params);
    },

    /**
     * Получение транзакции валюты по ID
     * @param {number} transactionId - ID транзакции
     * @returns {Promise<Object>} Данные транзакции
     */
    async getTransaction(transactionId) {
        return await window.APIClient.get(`/currency/transactions/${transactionId}`);
    },

    /**
     * Получение статуса ежедневного бонуса текущего пользователя
     * @returns {Promise<Object>} Статус бонуса (current_streak, can_claim, next_claim_available_at, bonus_amount)
     */
    async getDailyBonusStatus() {
        return await window.APIClient.get('/currency/daily-bonus/status');
    },

    /**
     * Забрать ежедневный бонус текущего пользователя
     * @returns {Promise<Object>} Результат получения бонуса (balance, bonus_amount, streak_day, next_claim_available_at)
     */
    async claimDailyBonus() {
        return await window.APIClient.post('/currency/daily-bonus/claim');
    }
};
