// Новый подход: только сессионные данные + критический минимум
window.Storage = {
    prefix: 'dragon_vpn_',
    session: new Map(), // Сессионный кеш в памяти

    // Список данных, которые можно кешировать между сессиями
    PERSISTENT_KEYS: [
        'settings', // Настройки пользователя
        'instructions_state', // Состояние инструкций
        'device_preferences' // Предпочтения устройства
    ],

    async init() {
        Utils.log('info', 'Initializing minimal storage system');

        // Очищаем весь localStorage кроме критического минимума
        await this.cleanupStaleCache();

        // Инициализируем сессионный кеш
        this.session.clear();
    },

    // Основной метод получения данных
    async get(key, defaultValue = null, useSession = true) {
        // 1. Сначала проверяем сессионный кеш
        if (useSession && this.session.has(key)) {
            const cached = this.session.get(key);
            Utils.log('debug', `Using session cache for: ${key}`);
            return cached;
        }

        // 2. Если это персистентные данные - проверяем localStorage
        if (this.PERSISTENT_KEYS.includes(key)) {
            const stored = await this.getFromLocal(this.prefix + key, defaultValue);
            if (stored !== null) {
                // Кешируем в сессии для быстрого доступа
                this.session.set(key, stored);
                return stored;
            }
        }

        return defaultValue;
    },

    // Сохранение данных
    async set(key, value, persist = false) {
        // Всегда сохраняем в сессионный кеш
        this.session.set(key, value);

        // Сохраняем в localStorage только если разрешено
        if (persist && this.PERSISTENT_KEYS.includes(key)) {
            return this.setToLocal(this.prefix + key, value);
        }

        return true;
    },

    // Удаление устаревшего кеша
    async cleanupStaleCache() {
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    // Удаляем все кроме критического минимума
                    const cleanKey = key.replace(this.prefix, '');
                    if (!this.PERSISTENT_KEYS.includes(cleanKey)) {
                        keys.push(key);
                    }
                }
            }

            keys.forEach(key => {
                localStorage.removeItem(key);
                Utils.log('debug', `Removed stale cache: ${key}`);
            });

            Utils.log('info', `Cleaned up ${keys.length} stale cache entries`);
        } catch (error) {
            Utils.log('error', 'Failed to cleanup stale cache:', error);
        }
    },

    // Специальные методы для актуальных данных
    async getSubscriptions() {
        return this.session.get('subscriptions') || [];
    },

    async setSubscriptions(subscriptions) {
        this.session.set('subscriptions', subscriptions);
        // НЕ сохраняем в localStorage - только актуальные данные
    },

    async getUserData() {
        return this.session.get('user_data') || null;
    },

    async setUserData(userData) {
        this.session.set('user_data', userData);
        // НЕ сохраняем в localStorage
    },

    // Очистка сессии при logout/refresh
    clearSession() {
        this.session.clear();
        Utils.log('info', 'Session cache cleared');
    },

    // Получение только персистентных настроек
    async getSettings() {
        const defaultSettings = {
            notifications: true,
            hapticFeedback: true,
            language: 'ru',
            theme: 'dark'
        };
        return await this.get('settings', defaultSettings, false); // Не из сессии
    },

    async setSettings(settings) {
        return await this.set('settings', settings, true); // Персистентно
    }
};