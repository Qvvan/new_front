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
            // Не закрываем если идет скролл (пользователь начал скролл внутри модального окна)
            if (this.backdrop.dataset.scrolling === 'true') {
                return;
            }
            
            // Проверяем что клик именно на backdrop, а не на модальное окно
            if (e.target === this.backdrop && this.modalStack.length > 0) {
                const topModalId = this.modalStack[this.modalStack.length - 1];
                const modalData = this.activeModals.get(topModalId);
                if (modalData && modalData.config.closable !== false) {
                    // Вызываем onCancel если есть, чтобы Promise резолвился
                    if (modalData.config.onCancel) {
                        modalData.config.onCancel(topModalId);
                    }
                    this.close(topModalId);
                }
            }
        });
        
        // Предотвращаем закрытие при mouseup/touchend если был скролл
        this.backdrop.addEventListener('mouseup', (e) => {
            if (this.backdrop.dataset.scrolling === 'true' && e.target === this.backdrop) {
                e.stopPropagation();
            }
        });
        
        this.backdrop.addEventListener('touchend', (e) => {
            if (this.backdrop.dataset.scrolling === 'true' && e.target === this.backdrop) {
                e.stopPropagation();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.hasActiveModals()) {
                const topModalId = this.modalStack[this.modalStack.length - 1];
                const modalData = this.activeModals.get(topModalId);
                if (modalData) {
                    // Вызываем onCancel если есть, чтобы Promise резолвился
                    if (modalData.config.onCancel) {
                        modalData.config.onCancel(topModalId);
                    }
                    this.close(topModalId);
                }
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

        // Убеждаемся что backdrop готов к показу
        if (!this.backdrop.parentNode) {
            document.body.appendChild(this.backdrop);
        }

        // Добавляем в DOM
        this.backdrop.appendChild(modal);
        this.activeModals.set(modalConfig.id, { element: modal, config: modalConfig });
        this.modalStack.push(modalConfig.id);

        // Сбрасываем стили backdrop перед показом (сразу, без задержки)
        this.backdrop.style.transition = '';
        this.backdrop.style.opacity = '';
        this.backdrop.style.visibility = 'visible';
        this.backdrop.style.pointerEvents = 'auto';

        // Показываем фон
        this.backdrop.classList.add('active');

        // Анимация появления (используем requestAnimationFrame для плавности)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                modal.classList.add('active');
            });
        });

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
        // Группируем кнопки по позициям
        const leftButtons = buttons.filter(b => !b.position || b.position === 'left');
        const rightButtons = buttons.filter(b => b.position === 'right');
        
        const renderButton = (button) => {
            const btnClass = button.type === 'primary' ? 'btn btn-primary' : 'btn btn-secondary';
            const disabledClass = button.disabled ? 'btn-disabled' : '';
            const disabledAttr = button.disabled ? 'disabled' : '';
            return `
                <button class="${btnClass} ${disabledClass}" 
                        data-action="${button.action || 'custom'}" 
                        data-button-id="${button.id || ''}"
                        ${disabledAttr}>
                    ${button.icon ? `<i class="${button.icon}"></i>` : ''}
                    ${Utils.escapeHtml(button.text)}
                </button>
            `;
        };
        
        // Если есть кнопки справа, используем flex layout
        if (rightButtons.length > 0) {
            return `
                <div class="modal-actions-left">
                    ${leftButtons.map(renderButton).join('')}
                </div>
                <div class="modal-actions-right">
                    ${rightButtons.map(renderButton).join('')}
                </div>
            `;
        }
        
        // Иначе обычный рендеринг
        return buttons.map(renderButton).join('');
    },

    /**
     * Настройка событий модального окна
     */
    setupModalEvents(modal, config) {
        modal.addEventListener('click', (e) => {
            // Ищем кнопку или элемент внутри кнопки
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            
            const action = button.dataset.action;
            const buttonId = button.dataset.buttonId;

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
                const closeModalData = this.activeModals.get(modalId);
                if (closeModalData && closeModalData.config.onCancel) {
                    closeModalData.config.onCancel(modalId);
                }
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
                    // Находим элемент кнопки в DOM
                    const modalElement = this.activeModals.get(modalId)?.element;
                    if (!modalElement) return;
                    
                    const buttonElement = modalElement.querySelector(`button[data-button-id="${buttonId}"]`);
                    
                    // Проверяем disabled состояние
                    if (buttonElement && (buttonElement.disabled || buttonElement.classList.contains('btn-disabled'))) {
                        return; // Не обрабатываем клик по disabled кнопке
                    }
                    
                    // Вызываем обработчик (может быть async)
                    try {
                        // Вызываем без параметров, так как handler может не принимать modalId
                        const result = button.handler();
                        
                        // Обрабатываем Promise если обработчик async
                        if (result instanceof Promise) {
                            result.then((resolvedResult) => {
                                // Закрываем только если явно указано closeAfter !== false и результат не false/keep-open
                                if (resolvedResult !== false && resolvedResult !== 'keep-open' && button.closeAfter !== false) {
                                    this.close(modalId);
                                }
                            }).catch(() => {
                                // При ошибке не закрываем модальное окно
                            });
                        } else {
                            // Синхронный результат
                            if (result !== false && result !== 'keep-open' && button.closeAfter !== false) {
                                this.close(modalId);
                            }
                        }
                    } catch (error) {
                        // При ошибке не закрываем модальное окно
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

        // Удаляем из стека сразу
        const stackIndex = this.modalStack.indexOf(modalId);
        if (stackIndex !== -1) {
            this.modalStack.splice(stackIndex, 1);
        }

        // Удаляем из активных сразу
        this.activeModals.delete(modalId);

        // Скрываем модальное окно
        element.classList.remove('active');
        element.style.opacity = '0';
        element.style.transform = 'scale(0.95)';

        // Если это последнее модальное окно - скрываем backdrop сразу
        const isLastModal = this.modalStack.length === 0;
        if (isLastModal) {
            this.backdrop.classList.remove('active');
            this.backdrop.style.opacity = '0';
            this.backdrop.style.visibility = 'hidden';
            this.backdrop.style.pointerEvents = 'none';
        }

        // Удаляем из DOM в следующем кадре анимации
        requestAnimationFrame(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }

            // Сбрасываем стили элемента
            element.style.transition = '';
            element.style.opacity = '';
            element.style.transform = '';

            // Полностью сбрасываем стили backdrop если нет активных модальных окон
            if (isLastModal) {
                this.backdrop.style.transition = '';
                this.backdrop.style.opacity = '';
                this.backdrop.style.visibility = '';
                this.backdrop.style.pointerEvents = '';
            }

            // Вызываем callback
            if (typeof config.onHide === 'function') {
                config.onHide(modalId);
            }
        });
    },

    /**
     * Закрыть верхнее модальное окно
     */
    closeTop() {
        if (this.modalStack.length > 0) {
            const topModalId = this.modalStack[this.modalStack.length - 1];
            const modalData = this.activeModals.get(topModalId);
            if (modalData && modalData.config.onCancel) {
                modalData.config.onCancel(topModalId);
            }
            this.close(topModalId);
        }
    },

    /**
     * Скрыть модальное окно (алиас для closeTop)
     */
    hide() {
        this.closeTop();
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