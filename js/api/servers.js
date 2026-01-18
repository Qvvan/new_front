// Servers API for Dragon VPN Mini App

window.ServersAPI = {
    /**
     * Получение списка всех серверов
     * @returns {Promise<Array>} Список серверов с информацией о нагрузке
     */
    async getServers() {
        return await window.APIClient.get('/servers');
    },

    /**
     * Получение сервера по ID
     * @param {number} serverId - ID сервера
     * @returns {Promise<Object>} Данные сервера
     */
    async getServer(serverId) {
        return await window.APIClient.get(`/servers/${serverId}`);
    },

    /**
     * Получение статистики сервера
     * @param {number} serverId - ID сервера
     * @returns {Promise<Object>} Статистика сервера
     */
    async getServerStats(serverId) {
        return await window.APIClient.get(`/servers/${serverId}/stats`);
    }
};
