// Services API for Dragon VPN Mini App

window.ServiceAPI = {
    /**
     * Получение списка всех сервисов/тарифов
     * @returns {Promise<Array>} Список сервисов
     */
    async getServices() {
        return await window.APIClient.get('/services');
    },

    /**
     * Получение сервиса по ID
     * @param {number} serviceId - ID сервиса
     * @returns {Promise<Object>} Данные сервиса
     */
    async getService(serviceId) {
        return await window.APIClient.get(`/services/${serviceId}`);
    },

    /**
     * Создание нового сервиса (админ функция)
     * @param {Object} data - Данные сервиса
     * @returns {Promise<Object>} Созданный сервис
     */
    async createService(data) {
        return await window.APIClient.post('/services', data);
    },

    /**
     * Обновление сервиса (админ функция)
     * @param {number} serviceId - ID сервиса
     * @param {Object} serviceData - Данные для обновления
     * @returns {Promise<Object>} Обновленный сервис
     */
    async updateService(serviceId, serviceData) {
        return await window.APIClient.put(`/services/${serviceId}`, serviceData);
    }
};