// Modal System for Dragon VPN Mini App

window.Modal = {
    activeModals: new Map(),
    modalStack: [],
    backdrop: null,

    /**
     * Инициализация системы модальных окон
     */
    init() {
        this.createBackdrop();
        this.setupGlobalEvents();
    },

    /**
     * Создание фонового слоя
     */
    createBackdrop() {
        this.backdrop = document.getElementById('modalOverlay');
        if (!this.backdrop) {
            this.backdrop = Utils.createElement('div', {
                id: 'modalOverlay',
                className: 'modal-overlay'
            });
            document.body.appendChild(this.backdrop);
        }
    },

    /**
     * Настройка глобальных событий
     */
    setupGlobalEvents() {
        // Закрытие по клику на фон
        this.backdrop.addEventListener('click', (e) => {
            if (e.target === this.backdrop) {
                this.closeTop();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.hasActiveModals()) {
                this.closeTop();
            }
        });
    },

    /**
     * Показать модальное окно
     * @param {Object} config - Конфигурация модального окна
     */
    show(config) {
        const defaultConfig = {
            id: Utils.generateId(),
            title: '',
            content: '',
            size: 'medium', // small, medium, large, full
            closable: true,
            backdrop: true,
            animation: 'scale', // scale, slide, fade
            buttons: [],
            onShow: null,
            onHide: null,
            onConfirm: null,
            onCancel: null
        };

        const modalConfig = { ...defaultConfig, ...config };
        const modal = this.createModal(modalConfig);

        // Добавляем в DOM
        this.backdrop.appendChild(modal);
        this.activeModals.set(modalConfig.id, { element: modal, config: modalConfig });
        this.modalStack.push(modalConfig.id);

        // Показываем фон
        this.backdrop.classList.add('active');

        // Анимация появления
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);

        // Вызываем callback
        if (typeof modalConfig.onShow === 'function') {
            modalConfig.onShow(modalConfig.id);
        }

        // Вибрация
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }

        return modalConfig.id;
    },

    /**
     * Создание элемента модального окна
     */
    createModal(config) {
        const modal = Utils.createElement('div', {
            className: `modal modal-${config.size} modal-${config.animation}`,
            dataset: { modalId: config.id }
        });

        const content = `
            <div class="modal-content">
                ${config.title ? `
                    <div class="modal-header">
                        <h3 class="modal-title">${Utils.escapeHtml(config.title)}</h3>
                        ${config.closable ? `
                            <button class="modal-close" data-action="close">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                    </div>
                ` : ''}

                <div class="modal-body">
                    ${config.content}
                </div>

                ${config.buttons.length > 0 ? `
                    <div class="modal-actions">
                        ${this.renderButtons(config.buttons)}
                    </div>
                ` : ''}
            </div>
        `;

        modal.innerHTML = content;
        this.setupModalEvents(modal, config);

        return modal;
    },

    /**
     * Рендеринг кнопок
     */
    renderButtons(buttons) {
        return buttons.map(button => {
            const btnClass = button.type === 'primary' ? 'btn btn-primary' : 'btn btn-secondary';
            return `
                <button class="${btnClass}" data-action="${button.action || 'custom'}" data-button-id="${button.id || ''}">
                    ${button.icon ? `<i class="${button.icon}"></i>` : ''}
                    ${Utils.escapeHtml(button.text)}
                </button>
            `;
        }).join('');
    },

    /**
     * Настройка событий модального окна
     */
    setupModalEvents(modal, config) {
        modal.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            const buttonId = e.target.closest('[data-button-id]')?.dataset.buttonId;

            if (action) {
                this.handleModalAction(config.id, action, buttonId, config);
            }
        });
    },

    /**
     * Обработка действий в модальном окне
     */
    handleModalAction(modalId, action, buttonId, config) {
        switch (action) {
            case 'close':
                this.close(modalId);
                break;
            case 'confirm':
                if (typeof config.onConfirm === 'function') {
                    const result = config.onConfirm(modalId);
                    if (result !== false) {
                        this.close(modalId);
                    }
                } else {
                    this.close(modalId);
                }
                break;
            case 'cancel':
                if (typeof config.onCancel === 'function') {
                    config.onCancel(modalId);
                }
                this.close(modalId);
                break;
            case 'custom':
                // Находим кнопку и вызываем её обработчик
                const button = config.buttons.find(btn => btn.id === buttonId);
                if (button && typeof button.handler === 'function') {
                    const result = button.handler(modalId);
                    if (result !== false && button.closeAfter !== false) {
                        this.close(modalId);
                    }
                }
                break;
        }
    },

    /**
     * Закрыть модальное окно
     */
    close(modalId) {
        const modalData = this.activeModals.get(modalId);
        if (!modalData) return;

        const { element, config } = modalData;

        // Анимация скрытия
        element.classList.remove('active');

        // Уменьшаем задержку для быстрого закрытия
        setTimeout(() => {
            // Удаляем из DOM
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }

            // Удаляем из активных
            this.activeModals.delete(modalId);

            // Удаляем из стека
            const stackIndex = this.modalStack.indexOf(modalId);
            if (stackIndex !== -1) {
                this.modalStack.splice(stackIndex, 1);
            }

            // Скрываем фон если нет активных модалок
            if (this.modalStack.length === 0) {
                this.backdrop.classList.remove('active');
            }

            // Вызываем callback
            if (typeof config.onHide === 'function') {
                config.onHide(modalId);
            }

        }, 150); // Уменьшено с 300ms до 150ms для быстрого закрытия
    },

    /**
     * Закрыть верхнее модальное окно
     */
    closeTop() {
        if (this.modalStack.length > 0) {
            const topModalId = this.modalStack[this.modalStack.length - 1];
            this.close(topModalId);
        }
    },

    /**
     * Закрыть все модальные окна
     */
    closeAll() {
        const modalIds = [...this.modalStack];
        modalIds.forEach(id => this.close(id));
    },

    /**
     * Проверка наличия активных модальных окон
     */
    hasActiveModals() {
        return this.modalStack.length > 0;
    },

    /**
     * Быстрые методы для типичных модальных окон
     */

    /**
     * Подтверждение
     */
    showConfirm(title, message, options = {}) {
        return new Promise((resolve) => {
            const config = {
                title: title,
                content: `<p>${Utils.escapeHtml(message)}</p>`,
                buttons: [
                    {
                        id: 'cancel',
                        text: options.cancelText || 'Отмена',
                        action: 'cancel'
                    },
                    {
                        id: 'confirm',
                        text: options.confirmText || 'ОК',
                        type: 'primary',
                        action: 'confirm'
                    }
                ],
                onConfirm: () => {
                    resolve(true);
                },
                onCancel: () => {
                    resolve(false);
                },
                ...options
            };

            this.show(config);
        });
    },

    /**
     * Предупреждение
     */
    showAlert(title, message, options = {}) {
        return new Promise((resolve) => {
            const config = {
                title: title,
                content: `<p>${Utils.escapeHtml(message)}</p>`,
                buttons: [
                    {
                        id: 'ok',
                        text: options.okText || 'ОК',
                        type: 'primary',
                        action: 'confirm'
                    }
                ],
                onConfirm: () => {
                    resolve();
                },
                ...options
            };

            this.show(config);
        });
    },

    /**
     * Модальное окно с формой
     */
    showForm(title, fields, options = {}) {
        return new Promise((resolve, reject) => {
            const formId = `modal-form-${Utils.generateId()}`;
            const formContent = this.renderForm(formId, fields);

            const config = {
                title: title,
                content: formContent,
                size: options.size || 'medium',
                buttons: [
                    {
                        id: 'cancel',
                        text: options.cancelText || 'Отмена',
                        action: 'cancel'
                    },
                    {
                        id: 'submit',
                        text: options.submitText || 'Отправить',
                        type: 'primary',
                        handler: (modalId) => {
                            const formData = this.getFormData(formId);
                            const validation = this.validateForm(fields, formData);

                            if (validation.isValid) {
                                resolve(formData);
                                return true; // Закрыть модалку
                            } else {
                                this.showFormErrors(formId, validation.errors);
                                return false; // Не закрывать модалку
                            }
                        }
                    }
                ],
                onCancel: () => {
                    reject(new Error('Form cancelled'));
                },
                ...options
            };

            this.show(config);
        });
    },

    /**
     * Рендеринг формы
     */
    renderForm(formId, fields) {
        const fieldsHtml = fields.map(field => {
            switch (field.type) {
                case 'text':
                case 'email':
                case 'password':
                    return `
                        <div class="form-group">
                            <label class="form-label" for="${field.name}">${field.label}</label>
                            <input type="${field.type}"
                                   id="${field.name}"
                                   name="${field.name}"
                                   class="form-input"
                                   placeholder="${field.placeholder || ''}"
                                   ${field.required ? 'required' : ''}
                                   value="${field.value || ''}">
                            <div class="form-error" id="${field.name}-error"></div>
                        </div>
                    `;
                case 'textarea':
                    return `
                        <div class="form-group">
                            <label class="form-label" for="${field.name}">${field.label}</label>
                            <textarea id="${field.name}"
                                      name="${field.name}"
                                      class="form-textarea"
                                      placeholder="${field.placeholder || ''}"
                                      ${field.required ? 'required' : ''}
                                      rows="${field.rows || 3}">${field.value || ''}</textarea>
                            <div class="form-error" id="${field.name}-error"></div>
                        </div>
                    `;
                case 'select':
                    const optionsHtml = field.options.map(opt =>
                        `<option value="${opt.value}" ${opt.value === field.value ? 'selected' : ''}>${opt.text}</option>`
                    ).join('');
                    return `
                        <div class="form-group">
                            <label class="form-label" for="${field.name}">${field.label}</label>
                            <select id="${field.name}" name="${field.name}" class="form-select" ${field.required ? 'required' : ''}>
                                ${optionsHtml}
                            </select>
                            <div class="form-error" id="${field.name}-error"></div>
                        </div>
                    `;
                default:
                    return '';
            }
        }).join('');

        return `<form id="${formId}">${fieldsHtml}</form>`;
    },

    /**
     * Получение данных формы
     */
    getFormData(formId) {
        const form = document.getElementById(formId);
        if (!form) return {};

        const formData = new FormData(form);
        const data = {};

        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }

        return data;
    },

    /**
     * Валидация формы
     */
    validateForm(fields, data) {
        const errors = {};
        let isValid = true;

        fields.forEach(field => {
            const value = data[field.name];

            // Проверка обязательных полей
            if (field.required && (!value || value.trim() === '')) {
                errors[field.name] = 'Это поле обязательно для заполнения';
                isValid = false;
                return;
            }

            // Проверка email
            if (field.type === 'email' && value && !Utils.isValidEmail(value)) {
                errors[field.name] = 'Введите корректный email адрес';
                isValid = false;
                return;
            }

            // Кастомная валидация
            if (field.validator && typeof field.validator === 'function') {
                const validationResult = field.validator(value, data);
                if (validationResult !== true) {
                    errors[field.name] = validationResult;
                    isValid = false;
                }
            }
        });

        return { isValid, errors };
    },

    /**
     * Показ ошибок формы
     */
    showFormErrors(formId, errors) {
        // Очищаем предыдущие ошибки
        const form = document.getElementById(formId);
        if (!form) return;

        form.querySelectorAll('.form-error').forEach(el => {
            el.textContent = '';
        });

        // Показываем новые ошибки
        Object.keys(errors).forEach(fieldName => {
            const errorEl = document.getElementById(`${fieldName}-error`);
            if (errorEl) {
                errorEl.textContent = errors[fieldName];
            }
        });
    },

    /**
     * Обновление содержимого модального окна
     */
    updateContent(modalId, newContent) {
        const modalData = this.activeModals.get(modalId);
        if (!modalData) return false;

        const bodyEl = modalData.element.querySelector('.modal-body');
        if (bodyEl) {
            bodyEl.innerHTML = newContent;
            return true;
        }

        return false;
    },

    /**
     * Обновление заголовка модального окна
     */
    updateTitle(modalId, newTitle) {
        const modalData = this.activeModals.get(modalId);
        if (!modalData) return false;

        const titleEl = modalData.element.querySelector('.modal-title');
        if (titleEl) {
            titleEl.textContent = newTitle;
            return true;
        }

        return false;
    },

    /**
     * Получение активных модальных окон
     */
    getActiveModals() {
        return Array.from(this.activeModals.entries()).map(([id, data]) => ({
            id,
            config: data.config,
            element: data.element
        }));
    },

    /**
     * Очистка системы модальных окон
     */
    cleanup() {
        this.closeAll();

        if (this.backdrop && this.backdrop.parentNode) {
            this.backdrop.parentNode.removeChild(this.backdrop);
        }

        this.backdrop = null;
        this.activeModals.clear();
        this.modalStack = [];
    }
};