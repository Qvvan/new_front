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
     * Получение реферального ID из различных источников
     * @returns {string|null} ID реферера или null
     */
    getReferrerId() {
        let referrerId = null;

        // 1. Проверяем Telegram WebApp start_param
        if (window.TelegramApp?.webApp?.initDataUnsafe?.start_param) {
            const startParam = window.TelegramApp.webApp.initDataUnsafe.start_param;
            // Формат: ref_323993202 или просто 323993202
            if (startParam.startsWith('ref_')) {
                referrerId = startParam.substring(4);
            } else if (/^\d+$/.test(startParam)) {
                referrerId = startParam;
            }
        }

        // 2. Проверяем URL параметры
        if (!referrerId) {
            const urlParams = new URLSearchParams(window.location.search);
            const startParam = urlParams.get('startapp') || urlParams.get('start');
            if (startParam) {
                if (startParam.startsWith('ref_')) {
                    referrerId = startParam.substring(4);
                } else if (/^\d+$/.test(startParam)) {
                    referrerId = startParam;
                }
            }
        }

        // 3. Проверяем hash параметры (для веб-версии)
        if (!referrerId && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const hashStart = hashParams.get('startapp') || hashParams.get('start');
            if (hashStart) {
                if (hashStart.startsWith('ref_')) {
                    referrerId = hashStart.substring(4);
                } else if (/^\d+$/.test(hashStart)) {
                    referrerId = hashStart;
                }
            }
        }

        // 4. Проверяем Storage session cache (pending_referrer_id)
        if (!referrerId && window.Storage?.session) {
            try {
                const stored = window.Storage.session.get('pending_referrer_id');
                if (stored) {
                    referrerId = stored;
                }
            } catch (error) {
                // Игнорируем ошибки чтения
            }
        }

        // 5. Проверяем localStorage напрямую (для pending_referrer_id)
        if (!referrerId) {
            try {
                const stored = localStorage.getItem('dragon_vpn_pending_referrer_id');
                if (stored) {
                    referrerId = JSON.parse(stored);
                }
            } catch (error) {
                // Игнорируем ошибки чтения
            }
        }

        // 6. Проверяем App.pendingReferrerId
        if (!referrerId && window.App?.pendingReferrerId) {
            referrerId = window.App.pendingReferrerId;
        }

        // 7. Проверяем TelegramApp.referrerId
        if (!referrerId && window.TelegramApp?.referrerId) {
            referrerId = window.TelegramApp.referrerId;
        }

        return referrerId || null;
    },

    /**
     * Получение текущего пользователя из Telegram контекста
     * Теперь использует POST запрос и отправляет referrer_id если пользователь зашел через реферальную ссылку
     * @returns {Promise<Object>} Данные текущего пользователя
     */
    async getCurrentUser() {
        const requestData = {};
        
        // Получаем реферальный ID из различных источников
        const referrerId = this.getReferrerId();
        if (referrerId) {
            requestData.referrer_id = referrerId;
        }

        return await window.APIClient.post('/user/user', requestData);
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