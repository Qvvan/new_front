// js/core/storage.js
// Минималистичная система хранения: только сессионные данные + критический минимум настроек
window.Storage = {
    prefix: 'dragon_vpn_',
    session: new Map(), // Сессионный кеш в памяти (очищается при перезагрузке)

    // СТРОГО ограниченный список данных, которые можно сохранять между сессиями
    PERSISTENT_KEYS: [
        'settings',           // Настройки пользователя
        'instructions_state', // Состояние инструкций
        'device_preferences'  // Предпочтения устройства
        // pending_payments - НИКОГДА не сохраняем между сессиями!
    ],

    /**
     * Инициализация системы хранения
     */
    async init() {
        Utils.log('info', 'Initializing minimal storage system');

        // Агрессивно очищаем весь localStorage кроме критического минимума
        await this.cleanupStaleCache();

        // Полностью очищаем сессионный кеш
        this.session.clear();

        Utils.log('info', 'Storage initialized - session cache cleared');
    },

    /**
     * Основной метод получения данных
     */
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

    /**
     * Сохранение данных
     */
    async set(key, value, persist = false) {
        // Всегда сохраняем в сессионный кеш
        this.session.set(key, value);

        // Сохраняем в localStorage ТОЛЬКО для разрешенных ключей
        if (persist && this.PERSISTENT_KEYS.includes(key)) {
            return this.setToLocal(this.prefix + key, value);
        }

        return true;
    },

    /**
     * Удаление устаревшего кеша - агрессивная очистка
     */
    async cleanupStaleCache() {
        try {
            const keysToRemove = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    const cleanKey = key.replace(this.prefix, '');

                    // Удаляем ВСЕ кроме критического минимума
                    if (!this.PERSISTENT_KEYS.includes(cleanKey)) {
                        keysToRemove.push(key);
                    }
                }
            }

            // Удаляем все найденные ключи
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                Utils.log('debug', `Removed stale cache: ${key}`);
            });

            Utils.log('info', `Cleaned up ${keysToRemove.length} stale cache entries`);
        } catch (error) {
            Utils.log('error', 'Failed to cleanup stale cache:', error);
        }
    },

    /**
     * Работа с localStorage - вспомогательные методы
     */
    async getFromLocal(key, defaultValue = null) {
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : defaultValue;
        } catch (error) {
            Utils.log('error', `Failed to get from localStorage: ${key}`, error);
            return defaultValue;
        }
    },

    async setToLocal(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            Utils.log('error', `Failed to set to localStorage: ${key}`, error);
            return false;
        }
    },

    /**
     * АКТУАЛЬНЫЕ ДАННЫЕ - только в сессионном кеше
     */

    // Подписки - НЕ персистентные, только актуальные с API
    async getSubscriptions() {
        return this.session.get('subscriptions') || [];
    },

    async setSubscriptions(subscriptions) {
        this.session.set('subscriptions', subscriptions);
        Utils.log('debug', `Cached ${subscriptions.length} subscriptions in session`);
    },

    // Данные пользователя - НЕ персистентные
    async getUserData() {
        return this.session.get('user_data') || null;
    },

    async setUserData(userData) {
        this.session.set('user_data', userData);
        Utils.log('debug', 'Cached user data in session');
    },

    /**
     * PENDING ПЛАТЕЖИ - КРИТИЧЕСКИ ВАЖНО: только в сессии!
     */

    // Получение pending платежей - ТОЛЬКО из сессионного кеша
    async getPendingPayments() {
        const pending = this.session.get('pending_payments') || [];
        Utils.log('debug', `Retrieved ${pending.length} pending payments from session`);
        return pending;
    },

    // Добавление pending платежа - ТОЛЬКО в сессию
    async addPendingPayment(payment) {
        if (!payment || !payment.id) {
            Utils.log('warn', 'Invalid payment data for adding to pending');
            return;
        }

        const pending = await this.getPendingPayments();

        // Проверяем что платеж еще не добавлен
        const exists = pending.some(p =>
            p.id === payment.id || p.payment_id === payment.payment_id
        );

        if (exists) {
            Utils.log('debug', `Payment ${payment.id} already in pending list`);
            return;
        }

        // Создаем минимальный объект платежа
        const paymentData = {
            id: payment.id,
            payment_id: payment.payment_id,
            price: payment.price || 0,
            created_at: payment.created_at,
            description: payment.description || '',
            service_id: payment.service_id,
            service_name: payment.service_name || '',
            // Сохраняем URL для продолжения оплаты
            payment_url: payment.payment_url || payment.url || payment.confirmation_url || '',
            url: payment.url || '' // Для совместимости
        };

        pending.push(paymentData);
        this.session.set('pending_payments', pending);

        Utils.log('info', `Added pending payment to SESSION: ${payment.id}`);
    },

    // Удаление pending платежа
    async removePendingPayment(paymentId) {
        if (!paymentId) return 0;

        const pending = await this.getPendingPayments();
        const filtered = pending.filter(p =>
            p.id !== paymentId && p.payment_id !== paymentId
        );

        this.session.set('pending_payments', filtered);

        const removedCount = pending.length - filtered.length;
        Utils.log('info', `Removed ${removedCount} pending payment(s): ${paymentId}`);

        return filtered.length;
    },

    // ПОЛНАЯ очистка pending платежей
    async clearPendingPayments() {
        this.session.set('pending_payments', []);
        Utils.log('info', 'CLEARED all pending payments from session');
    },

    /**
     * ПЕРСИСТЕНТНЫЕ НАСТРОЙКИ - единственное что сохраняется между сессиями
     */

    async getSettings() {
        const defaultSettings = {
            notifications: true,
            hapticFeedback: true,
            language: 'ru',
            theme: 'dark'
        };
        return await this.get('settings', defaultSettings, false); // НЕ из сессии
    },

    async setSettings(settings) {
        return await this.set('settings', settings, true); // Персистентно
    },

    async getInstructionsState() {
        return await this.get('instructions_state', { completed: false }, false);
    },

    async setInstructionsState(state) {
        return await this.set('instructions_state', state, true);
    },

    async getDevicePreferences() {
        return await this.get('device_preferences', {}, false);
    },

    async setDevicePreferences(preferences) {
        return await this.set('device_preferences', preferences, true);
    },

    /**
     * УТИЛИТАРНЫЕ МЕТОДЫ
     */

    // Полная очистка сессии (при logout/ошибке)
    clearSession() {
        this.session.clear();
        Utils.log('info', 'Session cache completely cleared');
    },

    // Удаление конкретного ключа
    async remove(key) {
        this.session.delete(key);

        if (this.PERSISTENT_KEYS.includes(key)) {
            localStorage.removeItem(this.prefix + key);
        }
    },

    // Проверка существования ключа
    has(key) {
        return this.session.has(key);
    },

    // Получение размера сессионного кеша
    getSessionSize() {
        return this.session.size;
    },

    // Получение всех ключей сессии (для отладки)
    getSessionKeys() {
        return Array.from(this.session.keys());
    },

    // Полная очистка ВСЕХ данных (критическая операция)
    async clearAll() {
        // Очищаем сессию
        this.session.clear();

        // Очищаем ВСЕ данные localStorage с нашим префиксом
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });

        Utils.log('warn', `Cleared ALL storage data: ${keysToRemove.length} localStorage keys + session`);
    },

    /**
     * МЕТОДЫ ДЛЯ ОТЛАДКИ И МОНИТОРИНГА
     */

    // Получение статистики хранилища
    getStorageStats() {
        const sessionKeys = this.getSessionKeys();
        const localStorageKeys = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                localStorageKeys.push(key.replace(this.prefix, ''));
            }
        }

        return {
            sessionSize: this.session.size,
            sessionKeys: sessionKeys,
            persistentKeys: localStorageKeys,
            pendingPaymentsCount: (this.session.get('pending_payments') || []).length
        };
    },

    // Валидация состояния (для отладки)
    validateState() {
        const stats = this.getStorageStats();
        const issues = [];

        // Проверяем что pending платежи не попали в localStorage
        if (stats.persistentKeys.includes('pending_payments')) {
            issues.push('CRITICAL: pending_payments found in localStorage!');
        }

        // Проверяем размер сессии
        if (stats.sessionSize > 50) {
            issues.push(`Session cache is large: ${stats.sessionSize} items`);
        }

        return {
            isValid: issues.length === 0,
            issues: issues,
            stats: stats
        };
    }
};