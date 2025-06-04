// Toast Notification System for Dragon VPN Mini App

window.Toast = {
    container: null,
    toasts: new Map(),
    defaultDuration: 3000,
    maxToasts: 5,

    /**
     * Инициализация системы уведомлений
     */
    init() {
        this.createContainer();
        Utils.log('info', 'Toast system initialized');
    },

    /**
     * Создание контейнера для уведомлений
     */
    createContainer() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = Utils.createElement('div', {
                id: 'toastContainer',
                className: 'toast-container'
            });
            document.body.appendChild(this.container);
        }
    },

    /**
     * Показать уведомление
     * @param {string} message - Текст сообщения
     * @param {string} type - Тип ('success', 'error', 'warning', 'info')
     * @param {Object} options - Дополнительные опции
     */
    show(message, type = 'info', options = {}) {
        const config = {
            duration: options.duration || this.defaultDuration,
            icon: options.icon || this.getDefaultIcon(type),
            action: options.action || null,
            persistent: options.persistent || false,
            ...options
        };

        const toastId = Utils.generateId();
        const toast = this.createToast(toastId, message, type, config);

        // Добавляем в контейнер
        this.container.appendChild(toast);
        this.toasts.set(toastId, toast);

        // Ограничиваем количество тостов
        this.limitToasts();

        // Показываем с анимацией
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Вибрация в зависимости от типа
        this.triggerHaptic(type);

        // Автоматическое скрытие
        if (!config.persistent) {
            setTimeout(() => {
                this.hide(toastId);
            }, config.duration);
        }

        Utils.log('debug', `Toast shown: ${type} - ${message}`);
        return toastId;
    },

    /**
     * Создание элемента уведомления
     */
    createToast(id, message, type, config) {
        const toast = Utils.createElement('div', {
            className: `toast ${type}`,
            dataset: { toastId: id }
        });

        const content = `
            <div class="toast-content">
                ${config.icon ? `<i class="${config.icon}"></i>` : ''}
                <span class="toast-message">${Utils.escapeHtml(message)}</span>
            </div>
            ${config.action ? `
                <button class="toast-action" data-action="${config.action.id}">
                    ${config.action.text}
                </button>
            ` : ''}
            ${!config.persistent ? `
                <button class="toast-close">
                    <i class="fas fa-times"></i>
                </button>
            ` : ''}
        `;

        toast.innerHTML = content;

        // Обработчики событий
        this.setupToastEvents(toast, id, config);

        return toast;
    },

    /**
     * Настройка обработчиков событий для тоста
     */
    setupToastEvents(toast, id, config) {
        // Закрытие по клику на крестик
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hide(id);
            });
        }

        // Обработка действий
        const actionBtn = toast.querySelector('.toast-action');
        if (actionBtn && config.action) {
            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                if (typeof config.action.handler === 'function') {
                    config.action.handler();
                }

                // Автоматически скрываем после действия если не указано иное
                if (config.action.hideAfter !== false) {
                    this.hide(id);
                }
            });
        }

        // Закрытие по клику на весь тост (опционально)
        if (config.clickToClose !== false) {
            toast.addEventListener('click', () => {
                this.hide(id);
            });
        }
    },

    /**
     * Скрыть уведомление
     * @param {string} toastId - ID уведомления
     */
    hide(toastId) {
        const toast = this.toasts.get(toastId);
        if (!toast) return;

        toast.classList.remove('show');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toasts.delete(toastId);
        }, 300);

        Utils.log('debug', `Toast hidden: ${toastId}`);
    },

    /**
     * Получение иконки по умолчанию для типа
     */
    getDefaultIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    },

    /**
     * Вибрация в зависимости от типа
     */
    triggerHaptic(type) {
        if (!window.TelegramApp) return;

        switch (type) {
            case 'success':
                window.TelegramApp.haptic.success();
                break;
            case 'error':
                window.TelegramApp.haptic.error();
                break;
            case 'warning':
                window.TelegramApp.haptic.warning();
                break;
            default:
                window.TelegramApp.haptic.light();
        }
    },

    /**
     * Ограничение количества тостов
     */
    limitToasts() {
        if (this.toasts.size <= this.maxToasts) return;

        // Удаляем самые старые тосты
        const toastIds = Array.from(this.toasts.keys());
        const excessCount = this.toasts.size - this.maxToasts;

        for (let i = 0; i < excessCount; i++) {
            this.hide(toastIds[i]);
        }
    },

    /**
     * Быстрые методы для разных типов уведомлений
     */
    success(message, options = {}) {
        return this.show(message, 'success', options);
    },

    error(message, options = {}) {
        return this.show(message, 'error', {
            duration: 5000, // Ошибки показываем дольше
            ...options
        });
    },

    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    },

    info(message, options = {}) {
        return this.show(message, 'info', options);
    },

    /**
     * Уведомление с действием
     */
    showWithAction(message, actionText, actionHandler, type = 'info', options = {}) {
        return this.show(message, type, {
            ...options,
            action: {
                id: Utils.generateId(),
                text: actionText,
                handler: actionHandler
            }
        });
    },

    /**
     * Постоянное уведомление (не исчезает автоматически)
     */
    showPersistent(message, type = 'info', options = {}) {
        return this.show(message, type, {
            ...options,
            persistent: true
        });
    },

    /**
     * Уведомление о загрузке
     */
    showLoading(message = 'Загрузка...', options = {}) {
        return this.show(message, 'info', {
            icon: 'fas fa-spinner fa-spin',
            persistent: true,
            clickToClose: false,
            ...options
        });
    },

    /**
     * Скрыть все уведомления
     */
    hideAll() {
        const toastIds = Array.from(this.toasts.keys());
        toastIds.forEach(id => this.hide(id));
    },

    /**
     * Скрыть уведомления определенного типа
     */
    hideByType(type) {
        this.toasts.forEach((toast, id) => {
            if (toast.classList.contains(type)) {
                this.hide(id);
            }
        });
    },

    /**
     * Обновление сообщения в существующем тосте
     */
    update(toastId, newMessage, newType = null) {
        const toast = this.toasts.get(toastId);
        if (!toast) return false;

        const messageEl = toast.querySelector('.toast-message');
        if (messageEl) {
            messageEl.textContent = newMessage;
        }

        if (newType) {
            // Убираем старый тип
            toast.classList.remove('success', 'error', 'warning', 'info');
            // Добавляем новый
            toast.classList.add(newType);
        }

        return true;
    },

    /**
     * Специальные уведомления для приложения
     */

    // Успешная оплата
    paymentSuccess(amount, currency = 'RUB') {
        return this.success(`Платеж на ${Utils.formatPrice(amount, currency)} успешно обработан`, {
            duration: 5000,
            action: {
                id: 'view_subscription',
                text: 'Перейти к подписке',
                handler: () => window.Router?.navigate('subscription')
            }
        });
    },

    // Ошибка оплаты
    paymentError(error = 'Ошибка обработки платежа') {
        return this.error(error, {
            duration: 7000,
            action: {
                id: 'retry_payment',
                text: 'Повторить',
                handler: () => window.PaymentBanner?.retry()
            }
        });
    },

    // Копирование в буфер обмена
    copied(text = 'Скопировано в буфер обмена') {
        return this.success(text, { duration: 2000 });
    },

    // Проблемы с сетью
    networkError() {
        return this.error('Проблемы с подключением к интернету', {
            persistent: true,
            action: {
                id: 'retry_network',
                text: 'Повторить',
                handler: () => window.location.reload()
            }
        });
    },

    // Обновление подписки
    subscriptionUpdated(message = 'Подписка обновлена') {
        return this.success(message, {
            action: {
                id: 'view_keys',
                text: 'Получить ключи',
                handler: () => window.Router?.navigate('keys')
            }
        });
    },

    // Истечение подписки
    subscriptionExpiring(daysLeft) {
        const message = `Подписка истекает через ${daysLeft} ${Utils.pluralize(daysLeft, ['день', 'дня', 'дней'])}`;
        return this.warning(message, {
            duration: 8000,
            action: {
                id: 'renew_subscription',
                text: 'Продлить',
                handler: () => window.ServiceSelector?.show('renew')
            }
        });
    },

    /**
     * Получение активных уведомлений
     */
    getActiveToasts() {
        return Array.from(this.toasts.entries()).map(([id, element]) => ({
            id,
            element,
            type: Array.from(element.classList).find(cls =>
                ['success', 'error', 'warning', 'info'].includes(cls)
            ),
            message: element.querySelector('.toast-message')?.textContent
        }));
    },

    /**
     * Проверка существования уведомления
     */
    exists(toastId) {
        return this.toasts.has(toastId);
    },

    /**
     * Очистка системы уведомлений
     */
    cleanup() {
        this.hideAll();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.toasts.clear();
    }
};