// Services API for Dragon VPN Mini App

window.ServiceAPI = {
    /**
     * Получение списка всех сервисов/тарифов
     * @param {Object} params - Параметры запроса
     * @returns {Promise<Object>} Список сервисов
     */
    async getServices(params = { page: 1, page_size: 50 }) {
        return await window.APIClient.get('/services', params);
    },

    /**
     * Получение сервиса по ID
     * @param {string} serviceId - UUID сервиса
     * @returns {Promise<Object>} Данные сервиса
     */
    async getService(serviceId) {
        return await window.APIClient.get(`/service/${serviceId}`);
    },

    /**
     * Создание нового сервиса (админ функция)
     * @param {Object} data - Данные сервиса
     * @returns {Promise<Object>} Созданный сервис
     */
    async createService(data) {
        return await window.APIClient.post('/service', data);
    },

    /**
     * Обновление сервиса (админ функция)
     * @param {string} serviceId - UUID сервиса
     * @param {Object} serviceData - Данные для обновления
     * @returns {Promise<Object>} Обновленный сервис
     */
    async updateService(serviceId, serviceData) {
        return await window.APIClient.patch(`/service/${serviceId}`, { service: serviceData });
    }
};