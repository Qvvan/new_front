// Utility functions for Dragon VPN Mini App

window.Utils = {
    /**
     * Форматирование даты
     * @param {Date|string} date - Дата для форматирования
     * @param {string} format - Формат ('short', 'long', 'relative')
     * @returns {string} Отформатированная дата
     */
    formatDate(date, format = 'short') {
        const d = new Date(date);
        const now = new Date();

        if (format === 'relative') {
            const diffTime = Math.abs(d - now);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return 'сегодня';
            if (diffDays === 1) return 'вчера';
            if (diffDays <= 7) return `${diffDays} дн. назад`;
            if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} нед. назад`;
            return `${Math.ceil(diffDays / 30)} мес. назад`;
        }

        const options = format === 'long'
            ? { day: 'numeric', month: 'long', year: 'numeric' }
            : { day: 'numeric', month: 'short' };

        return new Intl.DateTimeFormat('ru-RU', options).format(d);
    },

    /**
     * Подсчет дней до даты
     * @param {Date|string} targetDate - Целевая дата
     * @returns {number} Количество дней
     */
    daysBetween(targetDate) {
        const target = new Date(targetDate);
        const now = new Date();
        const diffTime = target - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * Форматирование цены
     * @param {number} price - Цена
     * @param {string} currency - Валюта
     * @returns {string} Отформатированная цена
     */
    formatPrice(price, currency = 'RUB') {
        if (!price || price === 0) return '0 ₽';

        // Цены уже в правильном формате (рубли)
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: price % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        }).format(price);
    },

    /**
     * Склонение числительных
     * @param {number} count - Количество
     * @param {Array} forms - Формы слова [1, 2, 5]
     * @returns {string} Правильная форма
     */
    pluralize(count, forms) {
        const cases = [2, 0, 1, 1, 1, 2];
        const index = (count % 100 > 4 && count % 100 < 20)
            ? 2
            : cases[Math.min(count % 10, 5)];
        return forms[index];
    },

    /**
     * Генерация уникального ID
     * @returns {string} Уникальный ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Debounce функция
     * @param {Function} func - Функция для debounce
     * @param {number} wait - Время ожидания в мс
     * @returns {Function} Debounced функция
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle функция
     * @param {Function} func - Функция для throttle
     * @param {number} limit - Лимит времени в мс
     * @returns {Function} Throttled функция
     */
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Проверка валидности email
     * @param {string} email - Email для проверки
     * @returns {boolean} Валиден ли email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Экранирование HTML
     * @param {string} text - Текст для экранирования
     * @returns {string} Экранированный текст
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Форматирование времени в читаемый вид
     * @param {number} seconds - Секунды
     * @returns {string} Отформатированное время
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    },

    formatTimeUntil(targetDate) {
        const target = new Date(targetDate);
        const now = new Date();
        const diffMs = target - now;

        if (diffMs <= 0) return 'Доступно';

        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `через ${diffDays} ${this.pluralize(diffDays, ['день', 'дня', 'дней'])}`;
        if (diffHours > 0) return `через ${diffHours} ${this.pluralize(diffHours, ['час', 'часа', 'часов'])}`;
        if (diffMinutes > 0) return `через ${diffMinutes} ${this.pluralize(diffMinutes, ['минуту', 'минуты', 'минут'])}`;
        return 'Скоро';
    },

    /**
     * Создание элемента DOM с атрибутами
     * @param {string} tag - Тег элемента
     * @param {Object} attributes - Атрибуты элемента
     * @param {string|Node} content - Содержимое элемента
     * @returns {HTMLElement} Созданный элемент
     */
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);

        Object.keys(attributes).forEach(key => {
            if (key === 'className') {
                element.className = attributes[key];
            } else if (key === 'dataset') {
                Object.keys(attributes[key]).forEach(dataKey => {
                    element.dataset[dataKey] = attributes[key][dataKey];
                });
            } else {
                element.setAttribute(key, attributes[key]);
            }
        });

        if (typeof content === 'string') {
            element.innerHTML = content;
        } else if (content instanceof Node) {
            element.appendChild(content);
        }

        return element;
    },

    /**
     * Обертка контента в центрированный контейнер
     * @param {string} content - HTML контент
     * @returns {string} Обернутый контент
     */
    wrapContent(content) {
        return `<div class="content-wrapper">${content}</div>`;
    },


    /**
     * Копирование текста в буфер обмена
     * @param {string} text - Текст для копирования
     * @returns {Promise<boolean>} Успешность операции
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback для старых браузеров
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const result = document.execCommand('copy');
                textArea.remove();
                return result;
            }
        } catch (error) {
            return false;
        }
    },

    /**
     * Проверка поддержки функций браузера
     * @returns {Object} Объект с поддерживаемыми функциями
     */
    getBrowserSupport() {
        return {
            clipboard: !!navigator.clipboard,
            serviceWorker: 'serviceWorker' in navigator,
            webShare: !!navigator.share,
            vibration: !!navigator.vibrate,
            geolocation: !!navigator.geolocation,
            webGL: !!window.WebGLRenderingContext,
            webAssembly: !!window.WebAssembly,
            intersectionObserver: !!window.IntersectionObserver,
            resizeObserver: !!window.ResizeObserver
        };
    },

    /**
     * Определение платформы пользователя
     * @returns {string} Платформа ('ios', 'android', 'desktop')
     */
    getPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();

        if (/iphone|ipad|ipod/.test(userAgent)) {
            return 'ios';
        } else if (/android/.test(userAgent)) {
            return 'android';
        } else {
            return 'desktop';
        }
    },

    /**
     * Логирование - полностью отключено для производительности
     */
    log() {
        // Логи полностью удалены для снижения нагрузки
    },

};