// Storage System for Dragon VPN Mini App

window.Storage = {
    prefix: 'dragon_vpn_',
    cloudStorageEnabled: false,

    /**
     * Инициализация системы хранилища
     */
    async init() {
        Utils.log('info', 'Initializing Storage System');

        // Проверяем доступность Telegram Cloud Storage
        if (window.TelegramApp && window.TelegramApp.webApp && window.TelegramApp.webApp.CloudStorage) {
            this.cloudStorageEnabled = true;
            Utils.log('info', 'Telegram Cloud Storage available');
        }

        // Миграция старых данных если нужно
        await this.migrateData();
    },

    /**
     * Получение данных
     * @param {string} key - Ключ
     * @param {any} defaultValue - Значение по умолчанию
     * @param {boolean} useCloud - Использовать облачное хранилище
     * @returns {Promise<any>} Данные
     */
    async get(key, defaultValue = null, useCloud = false) {
        const fullKey = this.prefix + key;

        try {
            if (useCloud && this.cloudStorageEnabled) {
                return await this.getFromCloud(key, defaultValue);
            } else {
                return this.getFromLocal(fullKey, defaultValue);
            }
        } catch (error) {
            Utils.log('error', `Failed to get data for key: ${key}`, error);
            return defaultValue;
        }
    },

    /**
     * Сохранение данных
     * @param {string} key - Ключ
     * @param {any} value - Значение
     * @param {boolean} useCloud - Использовать облачное хранилище
     * @returns {Promise<boolean>} Успешность операции
     */
    async set(key, value, useCloud = false) {
        const fullKey = this.prefix + key;

        try {
            if (useCloud && this.cloudStorageEnabled) {
                return await this.setToCloud(key, value);
            } else {
                return this.setToLocal(fullKey, value);
            }
        } catch (error) {
            Utils.log('error', `Failed to set data for key: ${key}`, error);
            return false;
        }
    },

    /**
     * Удаление данных
     * @param {string} key - Ключ
     * @param {boolean} useCloud - Использовать облачное хранилище
     * @returns {Promise<boolean>} Успешность операции
     */
    async remove(key, useCloud = false) {
        const fullKey = this.prefix + key;

        try {
            if (useCloud && this.cloudStorageEnabled) {
                return await this.removeFromCloud(key);
            } else {
                return this.removeFromLocal(fullKey);
            }
        } catch (error) {
            Utils.log('error', `Failed to remove data for key: ${key}`, error);
            return false;
        }
    },

    /**
     * Получение из локального хранилища
     */
    getFromLocal(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;

            const parsed = JSON.parse(item);

            // Проверяем срок действия
            if (parsed.expires && parsed.expires < Date.now()) {
                localStorage.removeItem(key);
                return defaultValue;
            }

            return parsed.value;
        } catch (error) {
            Utils.log('warn', `Failed to parse local storage item: ${key}`, error);
            return defaultValue;
        }
    },

    /**
     * Сохранение в локальное хранилище
     */
    setToLocal(key, value, ttl = null) {
        try {
            const item = {
                value: value,
                timestamp: Date.now(),
                expires: ttl ? Date.now() + ttl : null
            };

            localStorage.setItem(key, JSON.stringify(item));
            return true;
        } catch (error) {
            Utils.log('error', `Failed to set local storage item: ${key}`, error);
            return false;
        }
    },

    /**
     * Удаление из локального хранилища
     */
    removeFromLocal(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            Utils.log('error', `Failed to remove local storage item: ${key}`, error);
            return false;
        }
    },

    /**
     * Получение из облачного хранилища
     */
    async getFromCloud(key, defaultValue = null) {
        return new Promise((resolve) => {
            if (!this.cloudStorageEnabled) {
                resolve(defaultValue);
                return;
            }

            try {
                window.TelegramApp.webApp.CloudStorage.getItem(key, (error, value) => {
                    if (error) {
                        Utils.log('warn', `Cloud storage get error for key ${key}:`, error);
                        resolve(defaultValue);
                        return;
                    }

                    if (value === null || value === undefined) {
                        resolve(defaultValue);
                        return;
                    }

                    try {
                        const parsed = JSON.parse(value);
                        resolve(parsed);
                    } catch (parseError) {
                        Utils.log('warn', `Failed to parse cloud storage value for key ${key}:`, parseError);
                        resolve(defaultValue);
                    }
                });
            } catch (error) {
                Utils.log('error', `Cloud storage access error for key ${key}:`, error);
                resolve(defaultValue);
            }
        });
    },

    /**
     * Сохранение в облачное хранилище
     */
    async setToCloud(key, value) {
        return new Promise((resolve) => {
            if (!this.cloudStorageEnabled) {
                resolve(false);
                return;
            }

            try {
                const stringValue = JSON.stringify(value);

                window.TelegramApp.webApp.CloudStorage.setItem(key, stringValue, (error, success) => {
                    if (error) {
                        Utils.log('error', `Cloud storage set error for key ${key}:`, error);
                        resolve(false);
                        return;
                    }

                    resolve(success || true);
                });
            } catch (error) {
                Utils.log('error', `Cloud storage set error for key ${key}:`, error);
                resolve(false);
            }
        });
    },

    /**
     * Удаление из облачного хранилища
     */
    async removeFromCloud(key) {
        return new Promise((resolve) => {
            if (!this.cloudStorageEnabled) {
                resolve(false);
                return;
            }

            try {
                window.TelegramApp.webApp.CloudStorage.removeItem(key, (error, success) => {
                    if (error) {
                        Utils.log('error', `Cloud storage remove error for key ${key}:`, error);
                        resolve(false);
                        return;
                    }

                    resolve(success || true);
                });
            } catch (error) {
                Utils.log('error', `Cloud storage remove error for key ${key}:`, error);
                resolve(false);
            }
        });
    },

    /**
     * Специальные методы для работы с данными приложения
     */

    // Пользователь
    async getUserData() {
        return await this.get('user_data', {}, true);
    },

    async setUserData(userData) {
        return await this.set('user_data', userData, true);
    },

    // Подписки
    async getSubscriptions() {
        return await this.get('subscriptions', []);
    },

    async setSubscriptions(subscriptions) {
        return await this.set('subscriptions', subscriptions);
    },

    // Настройки приложения
    async getSettings() {
        const defaultSettings = {
            notifications: true,
            hapticFeedback: true,
            autoRenewal: true,
            language: 'ru',
            theme: 'dark'
        };
        return await this.get('settings', defaultSettings, true);
    },

    async setSettings(settings) {
        return await this.set('settings', settings, true);
    },

    // Кэш API ответов
    async getCachedAPI(endpoint, maxAge = 5 * 60 * 1000) { // 5 минут по умолчанию
        const cacheKey = `api_cache_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const cached = await this.get(cacheKey);

        if (cached && cached.timestamp && (Date.now() - cached.timestamp < maxAge)) {
            Utils.log('debug', `Using cached API response for: ${endpoint}`);
            return cached.data;
        }

        return null;
    },

    async setCachedAPI(endpoint, data) {
        const cacheKey = `api_cache_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const cacheData = {
            data: data,
            timestamp: Date.now(),
            endpoint: endpoint
        };
        return await this.set(cacheKey, cacheData);
    },

    // Рефералы
    async getReferralData() {
        return await this.get('referral_data', { referrals: [], stats: {} });
    },

    async setReferralData(data) {
        return await this.set('referral_data', data);
    },

    // Платежи
    async getPendingPayments() {
        return await this.get('pending_payments', []);
    },

    async setPendingPayments(payments) {
        return await this.set('pending_payments', payments);
    },

    async addPendingPayment(payment) {
        const payments = await this.getPendingPayments();
        payments.push({
            ...payment,
            created_at: Date.now()
        });
        return await this.setPendingPayments(payments);
    },

    async removePendingPayment(paymentId) {
        const payments = await this.getPendingPayments();
        const filtered = payments.filter(p => p.id !== paymentId);
        return await this.setPendingPayments(filtered);
    },

    // VPN ключи
    async getVPNKeys() {
        return await this.get('vpn_keys', { profiles: [], individual_keys: [] });
    },

    async setVPNKeys(keys) {
        return await this.set('vpn_keys', keys);
    },

    // Состояние инструкций
    async getInstructionsState() {
        return await this.get('instructions_state', {
            completed: false,
            current_step: 0,
            device_type: null,
            skipped: false
        });
    },

    async setInstructionsState(state) {
        return await this.set('instructions_state', state);
    },

    // Последняя активность
    async updateLastActivity() {
        return await this.set('last_activity', Date.now());
    },

    async getLastActivity() {
        return await this.get('last_activity', Date.now());
    },

    /**
     * Очистка всех данных
     */
    async clear() {
        try {
            // Очищаем локальное хранилище
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    keys.push(key);
                }
            }

            keys.forEach(key => localStorage.removeItem(key));

            // Очищаем облачное хранилище если доступно
            if (this.cloudStorageEnabled) {
                const cloudKeys = await this.getCloudKeys();
                for (const key of cloudKeys) {
                    await this.removeFromCloud(key);
                }
            }

            Utils.log('info', 'Storage cleared successfully');
            return true;
        } catch (error) {
            Utils.log('error', 'Failed to clear storage:', error);
            return false;
        }
    },

    /**
     * Получение всех ключей из облачного хранилища
     */
    async getCloudKeys() {
        return new Promise((resolve) => {
            if (!this.cloudStorageEnabled) {
                resolve([]);
                return;
            }

            try {
                window.TelegramApp.webApp.CloudStorage.getKeys((error, keys) => {
                    if (error) {
                        Utils.log('error', 'Failed to get cloud keys:', error);
                        resolve([]);
                        return;
                    }

                    resolve(keys || []);
                });
            } catch (error) {
                Utils.log('error', 'Cloud storage getKeys error:', error);
                resolve([]);
            }
        });
    },

    /**
     * Синхронизация между локальным и облачным хранилищем
     */
    async sync() {
        if (!this.cloudStorageEnabled) {
            Utils.log('info', 'Cloud storage not available, skipping sync');
            return;
        }

        try {
            Utils.log('info', 'Starting storage sync');

            // Синхронизируем критически важные данные
            const criticalKeys = ['user_data', 'settings'];

            for (const key of criticalKeys) {
                const localData = await this.get(key, null, false);
                const cloudData = await this.get(key, null, true);

                // Если есть данные в облаке, но нет локально - берем из облака
                if (cloudData && !localData) {
                    await this.set(key, cloudData, false);
                    Utils.log('debug', `Synced ${key} from cloud to local`);
                }
                // Если есть локально, но нет в облаке - сохраняем в облако
                else if (localData && !cloudData) {
                    await this.set(key, localData, true);
                    Utils.log('debug', `Synced ${key} from local to cloud`);
                }
            }

            Utils.log('info', 'Storage sync completed');
        } catch (error) {
            Utils.log('error', 'Storage sync failed:', error);
        }
    },

    /**
     * Миграция данных из старых версий
     */
    async migrateData() {
        try {
            const version = await this.get('storage_version', '1.0.0');

            if (version === '1.0.0') {
                // Здесь будут миграции когда понадобится
                Utils.log('info', 'Storage is up to date');
            }

            // Устанавливаем текущую версию
            await this.set('storage_version', '1.0.0');
        } catch (error) {
            Utils.log('error', 'Data migration failed:', error);
        }
    },

    /**
     * Получение статистики использования хранилища
     */
    getStorageStats() {
        try {
            let localSize = 0;
            let localCount = 0;

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    const value = localStorage.getItem(key);
                    localSize += new Blob([value || '']).size;
                    localCount++;
                }
            }

            return {
                local: {
                    count: localCount,
                    size: localSize,
                    sizeFormatted: this.formatBytes(localSize)
                },
                cloudEnabled: this.cloudStorageEnabled
            };
        } catch (error) {
            Utils.log('error', 'Failed to get storage stats:', error);
            return null;
        }
    },

    /**
     * Форматирование размера в байтах
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};