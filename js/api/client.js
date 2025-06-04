// API Client for Dragon VPN Mini App

window.APIClient = {
    baseURL: 'http://localhost:8081', // Замените на ваш API URL
    defaultTimeout: 10000,

    /**
     * Выполнение HTTP запроса
     * @param {string} endpoint - Эндпоинт API
     * @param {string} method - HTTP метод
     * @param {Object} data - Данные для отправки
     * @param {Object} options - Дополнительные опции
     * @returns {Promise} Результат запроса
     */
    async request(endpoint, method = 'GET', data = null, options = {}) {
        const url = `${this.baseURL}${endpoint}`;

        const config = {
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeaders(),
                ...options.headers
            },
            ...options
        };

        // Добавляем данные для POST/PUT/PATCH запросов
        if (data && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
            config.body = JSON.stringify(data);
        }

        try {
            Utils.log('debug', `API Request: ${method} ${endpoint}`, data);

            // Добавляем timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')),
                    options.timeout || this.defaultTimeout);
            });

            const fetchPromise = fetch(url, config);
            const response = await Promise.race([fetchPromise, timeoutPromise]);

            Utils.log('debug', `API Response: ${response.status}`, {
                url,
                status: response.status,
                statusText: response.statusText
            });

            // Проверяем статус ответа
            if (!response.ok) {
                await this.handleErrorResponse(response);
            }

            // Парсим JSON ответ
            const result = await response.json();
            Utils.log('debug', 'API Success:', result);

            return result;

        } catch (error) {
            Utils.log('error', 'API Error:', error);

            // Обрабатываем различные типы ошибок
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('Нет соединения с сервером. Проверьте интернет подключение.');
            } else if (error.message === 'Request timeout') {
                throw new Error('Время ожидания запроса истекло. Попробуйте позже.');
            } else if (error.message.includes('CORS')) {
                throw new Error('Ошибка доступа к серверу. Обратитесь в поддержку.');
            }

            throw error;
        }
    },

    /**
     * Обработка ошибок HTTP ответов
     * @param {Response} response - HTTP ответ
     */
    async handleErrorResponse(response) {
        let errorMessage = 'Произошла ошибка при выполнении запроса';
        let errorData = null;

        try {
            errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
            // Если не удалось распарсить JSON ошибки
            errorMessage = response.statusText || errorMessage;
        }

        // Специфичные сообщения для различных статусов
        switch (response.status) {
            case 400:
                errorMessage = errorData?.message || 'Неверные данные запроса';
                break;
            case 401:
                errorMessage = 'Необходима авторизация';
                this.handleUnauthorized();
                break;
            case 403:
                errorMessage = 'Доступ запрещен';
                break;
            case 404:
                errorMessage = 'Ресурс не найден';
                break;
            case 429:
                errorMessage = 'Слишком много запросов. Попробуйте позже';
                break;
            case 500:
                errorMessage = 'Внутренняя ошибка сервера';
                break;
            case 503:
                errorMessage = 'Сервис временно недоступен';
                break;
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = errorData;
        throw error;
    },

    /**
     * Обработка неавторизованного доступа
     */
    handleUnauthorized() {
        Utils.log('warn', 'Unauthorized access detected');

        // Очищаем локальные данные
        if (window.Storage) {
            window.Storage.clear();
        }

        // Показываем уведомление
        if (window.Toast) {
            window.Toast.show('Сессия истекла. Перезапустите приложение', 'error');
        }

        // Перезагружаем приложение через некоторое время
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    },

    /**
     * Получение заголовков авторизации
     * @returns {Object} Заголовки
     */
    getAuthHeaders() {
        const headers = {};

        // Добавляем Telegram initData
        if (window.TelegramApp && window.TelegramApp.isInitialized) {
            const initData = window.TelegramApp.getInitData();
            if (initData) {
                headers['X-Telegram-Init-Data'] = initData;
            }
        }

        return headers;
    },

    /**
     * GET запрос
     * @param {string} endpoint - Эндпоинт
     * @param {Object} params - Параметры запроса
     * @param {Object} options - Дополнительные опции
     * @returns {Promise} Результат запроса
     */
    async get(endpoint, params = {}, options = {}) {
        let url = endpoint;

        // Добавляем параметры в URL
        if (Object.keys(params).length > 0) {
            const searchParams = new URLSearchParams();
            Object.keys(params).forEach(key => {
                if (params[key] !== null && params[key] !== undefined) {
                    searchParams.append(key, params[key]);
                }
            });
            url += `?${searchParams.toString()}`;
        }

        return this.request(url, 'GET', null, options);
    },

    /**
     * POST запрос
     * @param {string} endpoint - Эндпоинт
     * @param {Object} data - Данные
     * @param {Object} options - Дополнительные опции
     * @returns {Promise} Результат запроса
     */
    async post(endpoint, data = {}, options = {}) {
        return this.request(endpoint, 'POST', data, options);
    },

    /**
     * PUT запрос
     * @param {string} endpoint - Эндпоинт
     * @param {Object} data - Данные
     * @param {Object} options - Дополнительные опции
     * @returns {Promise} Результат запроса
     */
    async put(endpoint, data = {}, options = {}) {
        return this.request(endpoint, 'PUT', data, options);
    },

    /**
     * PATCH запрос
     * @param {string} endpoint - Эндпоинт
     * @param {Object} data - Данные
     * @param {Object} options - Дополнительные опции
     * @returns {Promise} Результат запроса
     */
    async patch(endpoint, data = {}, options = {}) {
        return this.request(endpoint, 'PATCH', data, options);
    },

    /**
     * DELETE запрос
     * @param {string} endpoint - Эндпоинт
     * @param {Object} options - Дополнительные опции
     * @returns {Promise} Результат запроса
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, 'DELETE', null, options);
    },

    /**
     * Загрузка файла
     * @param {string} endpoint - Эндпоинт
     * @param {FormData} formData - Данные формы с файлом
     * @param {Object} options - Дополнительные опции
     * @returns {Promise} Результат запроса
     */
    async upload(endpoint, formData, options = {}) {
        const config = {
            method: 'POST',
            headers: {
                ...this.getAuthHeaders(),
                ...options.headers
            },
            body: formData,
            ...options
        };

        // Удаляем Content-Type для FormData (браузер установит автоматически)
        delete config.headers['Content-Type'];

        const url = `${this.baseURL}${endpoint}`;

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                await this.handleErrorResponse(response);
            }

            return await response.json();
        } catch (error) {
            Utils.log('error', 'Upload Error:', error);
            throw error;
        }
    },

    /**
     * Скачивание файла
     * @param {string} endpoint - Эндпоинт
     * @param {string} filename - Имя файла
     * @param {Object} options - Дополнительные опции
     * @returns {Promise} Результат запроса
     */
    async download(endpoint, filename, options = {}) {
        const config = {
            method: 'GET',
            headers: {
                ...this.getAuthHeaders(),
                ...options.headers
            },
            ...options
        };

        const url = `${this.baseURL}${endpoint}`;

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                await this.handleErrorResponse(response);
            }

            const blob = await response.blob();

            // Создаем ссылку для скачивания
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            return true;
        } catch (error) {
            Utils.log('error', 'Download Error:', error);
            throw error;
        }
    },

    /**
     * Проверка состояния сервера
     * @returns {Promise<boolean>} Доступен ли сервер
     */
    async healthCheck() {
        try {
            await this.get('/health', {}, { timeout: 5000 });
            return true;
        } catch (error) {
            Utils.log('warn', 'Health check failed:', error);
            return false;
        }
    },

    /**
     * Retry запрос с экспоненциальной задержкой
     * @param {Function} requestFn - Функция запроса
     * @param {number} maxRetries - Максимальное количество попыток
     * @param {number} baseDelay - Базовая задержка в мс
     * @returns {Promise} Результат запроса
     */
    async retryRequest(requestFn, maxRetries = 3, baseDelay = 1000) {
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                lastError = error;

                // Не повторяем для определенных ошибок
                if (error.status && [400, 401, 403, 404].includes(error.status)) {
                    throw error;
                }

                if (attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(2, attempt);
                    Utils.log('warn', `Request failed, retrying in ${delay}ms`, error);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    },

    /**
     * Групповой запрос (batch)
     * @param {Array} requests - Массив запросов
     * @param {Object} options - Опции
     * @returns {Promise<Array>} Результаты запросов
     */
    async batch(requests, options = {}) {
        const { concurrent = 3, failFast = false } = options;
        const results = [];
        const errors = [];

        // Разделяем запросы на группы
        for (let i = 0; i < requests.length; i += concurrent) {
            const batch = requests.slice(i, i + concurrent);

            try {
                const batchPromises = batch.map(async (request, index) => {
                    try {
                        const result = await this.request(
                            request.endpoint,
                            request.method || 'GET',
                            request.data,
                            request.options
                        );
                        return { success: true, data: result, index: i + index };
                    } catch (error) {
                        const errorResult = { success: false, error, index: i + index };
                        if (failFast) throw error;
                        return errorResult;
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);

            } catch (error) {
                if (failFast) {
                    throw error;
                }
                errors.push(error);
            }
        }

        return {
            results: results.sort((a, b) => a.index - b.index),
            hasErrors: errors.length > 0 || results.some(r => !r.success),
            errors
        };
    },

    /**
     * Установка базового URL
     * @param {string} url - Новый базовый URL
     */
    setBaseURL(url) {
        this.baseURL = url.replace(/\/$/, ''); // Убираем слеш в конце
        Utils.log('info', `API base URL set to: ${this.baseURL}`);
    },

    /**
     * Установка таймаута по умолчанию
     * @param {number} timeout - Таймаут в мс
     */
    setTimeout(timeout) {
        this.defaultTimeout = timeout;
        Utils.log('info', `API timeout set to: ${timeout}ms`);
    }
};