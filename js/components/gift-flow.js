// Gift Flow Component for Dragon VPN Mini App

window.GiftFlow = {
    isVisible: false,
    currentStep: 1, // 1: выбор услуги, 2: получатель и сообщение, 3: сводка
    services: [],
    selectedService: null,
    giftData: {
        service_id: null,
        recipient_user_id: null,
        message: null,
        sender_display_name: null
    },
    modalId: null,

    /**
     * Показать процесс подарка
     */
    async show() {
        Utils.log('info', 'Showing gift flow');

        try {
            this.currentStep = 1;
            this.resetGiftData();

            // Используем ServiceSelector для выбора услуги (как для продления/новой подписки)
            if (window.ServiceSelector) {
                await window.ServiceSelector.show('gift');
            } else {
                Utils.log('error', 'ServiceSelector component not available');
                if (window.Toast) {
                    window.Toast.error('Компонент выбора услуг недоступен');
                }
            }

        } catch (error) {
            Utils.log('error', 'Failed to show gift flow:', error);
            if (window.Toast) {
                window.Toast.error('Ошибка загрузки услуг');
            }
        }
    },

    /**
     * Загрузка списка услуг
     */
    async loadServices() {
        try {
            if (window.ServiceAPI) {
                const response = await window.ServiceAPI.getServices();
                const servicesList = Array.isArray(response) ? response : (response.services || []);

                // Исключаем пробный период
                this.services = servicesList.filter(s => !s.is_trial).map(service => ({
                    ...service,
                    duration: this.formatDuration(service.duration_days),
                    discount: service.has_discount && service.discount_percent ? service.discount_percent : 0,
                    popular: service.is_featured || false
                }));

                Utils.log('info', `Loaded ${this.services.length} services for gift`);
            }
        } catch (error) {
            Utils.log('error', 'Failed to load services:', error);
            throw error;
        }
    },

    formatDuration(days) {
        if (days >= 360) return `${Math.round(days / 365)} год`;
        if (days >= 30) return `${Math.round(days / 30)} мес`;
        return `${days} дн`;
    },

    /**
     * Сброс данных подарка
     */
    resetGiftData() {
        this.selectedService = null;
        this.giftData = {
            service_id: null,
            recipient_user_id: null,
            message: null,
            sender_display_name: null
        };
    },

    /**
     * Шаг 1: Выбор услуги
     */
    showStep1() {
        const serviceCards = this.services.map(service => {
            const monthlyPrice = this.calculateMonthlyPrice(service);
            const originalPrice = service.original_price || service.price;
            const hasDiscount = service.discount && service.discount > 0;
            const features = service.features || [];

            return `
                <div class="service-card ${this.selectedService?.id === service.id ? 'selected' : ''}" 
                     data-service-id="${service.id}">
                    ${service.popular ? '<div class="service-badge">Популярный</div>' : ''}
                    ${hasDiscount ? `<div class="service-discount">-${service.discount}%</div>` : ''}

                    <div class="service-header">
                        <div class="service-info">
                            <h4 class="service-name">${service.name}</h4>
                            <p class="service-duration">${service.duration || 'Не указано'}</p>
                        </div>
                        <div class="service-pricing">
                            <div class="service-price">${Utils.formatPrice(service.price, service.currency)}</div>
                            ${hasDiscount ? `<div class="service-original-price">${Utils.formatPrice(originalPrice, service.currency)}</div>` : ''}
                            <div class="service-monthly">${Utils.formatPrice(monthlyPrice, service.currency)}/мес</div>
                        </div>
                    </div>

                    <ul class="service-features">
                        ${features.map(feature => `<li>${feature}</li>`).join('')}
                    </ul>

                    ${hasDiscount ? `
                        <div class="service-savings">
                            Экономия: ${Utils.formatPrice(originalPrice - service.price, service.currency)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        const content = `
            <div class="gift-flow-step gift-step-1">
                <div class="gift-step-content">
                    <p class="gift-step-description">
                        <i class="fas fa-gift"></i>
                        Выберите подписку, которую хотите подарить
                    </p>
                    <div class="services-list">
                        ${serviceCards}
                    </div>
                </div>
            </div>
        `;

        if (this.modalId) {
            window.Modal.close(this.modalId);
        }

        this.modalId = window.Modal.show({
            title: 'Подарить подписку',
            content: content,
            size: 'large',
            closable: true,
            buttons: [
                {
                    id: 'cancel',
                    text: 'Отмена',
                    action: 'cancel'
                },
                {
                    id: 'next',
                    text: 'Далее',
                    type: 'primary',
                    action: 'custom',
                    handler: () => {
                        if (!this.selectedService) {
                            if (window.Toast) {
                                window.Toast.error('Выберите услугу для подарка');
                            }
                            return false;
                        }
                        this.showStep2();
                        return false;
                    }
                }
            ],
            onShow: () => {
                this.isVisible = true;
                this.setupServiceSelection();
            },
            onCancel: () => {
                this.hide();
            },
            onHide: () => {
                this.isVisible = false;
            }
        });
    },

    /**
     * Настройка выбора услуги
     */
    setupServiceSelection() {
        setTimeout(() => {
            const cards = document.querySelectorAll('.gift-flow-step .service-card');
            cards.forEach(card => {
                card.addEventListener('click', () => {
                    const serviceId = parseInt(card.dataset.serviceId);
                    this.selectedService = this.services.find(s => s.id === serviceId);
                    this.giftData.service_id = serviceId;

                    // Обновляем визуально
                    cards.forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');

                    // Вибрация
                    if (window.TelegramApp) {
                        window.TelegramApp.haptic.selection();
                    }
                });
            });
        }, 100);
    },

    /**
     * Шаг 2: Получатель и сообщение
     */
    showStep2() {
        const content = `
            <div class="gift-flow-step gift-step-2">
                <div class="gift-step-content">
                    <p class="gift-step-description">
                        <i class="fas fa-user"></i>
                        Кому хотите подарить подписку?
                    </p>

                    <div class="gift-recipient-options">
                        <label class="gift-option-radio">
                            <input type="radio" name="recipient_type" value="none" checked>
                            <span class="gift-radio-content">
                                <i class="fas fa-ticket-alt"></i>
                                <div>
                                    <strong>Без указания получателя</strong>
                                    <span>Создастся код активации, который можно передать любому</span>
                                </div>
                            </span>
                        </label>

                        <label class="gift-option-radio">
                            <input type="radio" name="recipient_type" value="specific">
                            <span class="gift-radio-content">
                                <i class="fas fa-user-plus"></i>
                                <div>
                                    <strong>Конкретному пользователю</strong>
                                    <span>Подписка будет отправлена выбранному пользователю</span>
                                </div>
                            </span>
                        </label>
                    </div>

                    <div class="gift-form-fields">
                        <div class="gift-field">
                            <label for="gift-sender-name">Ваше имя (для получателя)</label>
                            <input type="text" 
                                   id="gift-sender-name" 
                                   class="gift-input" 
                                   placeholder="Оставьте пустым для анонимного подарка"
                                   maxlength="100">
                            <small class="gift-field-hint">Только буквы и пробелы</small>
                        </div>

                        <div class="gift-field">
                            <label for="gift-recipient-select">Получатель (если указан конкретный пользователь)</label>
                            <button type="button" 
                                    id="gift-select-friend-btn" 
                                    class="btn btn-secondary gift-select-friend-btn"
                                    disabled>
                                <i class="fas fa-user-plus"></i>
                                <span id="gift-selected-friend-text">Выбрать друга</span>
                            </button>
                            <input type="hidden" id="gift-recipient-id" value="">
                        </div>

                        <div class="gift-field">
                            <label for="gift-message">Сообщение для получателя (необязательно)</label>
                            <textarea id="gift-message" 
                                      class="gift-textarea" 
                                      placeholder="Напишите добрые пожелания..."
                                      maxlength="500"
                                      rows="4"></textarea>
                            <small class="gift-field-hint">До 500 символов</small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Закрываем предыдущее модальное окно, если есть
        if (this.modalId) {
            window.Modal.close(this.modalId);
        }

        // Создаем новое модальное окно для шага 2
        this.modalId = window.Modal.show({
            title: 'Подарить подписку',
            content: content,
            size: 'large',
            closable: true,
            buttons: [
                {
                    id: 'back',
                    text: 'Назад',
                    action: 'custom',
                    handler: () => {
                        // Возвращаемся к выбору услуги через ServiceSelector
                        if (window.ServiceSelector) {
                            this.hide();
                            window.ServiceSelector.show('gift');
                        }
                        return false;
                    }
                },
                {
                    id: 'next',
                    text: 'Далее',
                    type: 'primary',
                    action: 'custom',
                    handler: () => {

                        // Валидация имени отправителя
                        const senderNameInput = document.getElementById('gift-sender-name');
                        if (senderNameInput && senderNameInput.value.trim()) {
                            const namePattern = /^[a-zA-Zа-яА-ЯёЁ\s]+$/;
                            if (!namePattern.test(senderNameInput.value.trim())) {
                                if (window.Toast) {
                                    window.Toast.error('Имя может содержать только буквы и пробелы');
                                }
                                return false;
                            }
                        }

                        // Проверка, если выбран конкретный получатель
                        const recipientType = document.querySelector('input[name="recipient_type"]:checked')?.value;
                        const recipientHiddenInput = document.getElementById('gift-recipient-id');
                        if (recipientType === 'specific' && (!recipientHiddenInput || !recipientHiddenInput.value || !this.giftData.recipient_user_id)) {
                            if (window.Toast) {
                                window.Toast.error('Выберите друга для получения подарка');
                            }
                            return false;
                        }

                        this.showStep3();
                        return false;
                    }
                }
            ],
            onShow: () => {
                this.isVisible = true;
                this.setupStep2Handlers();
            },
            onCancel: () => {
                this.hide();
            },
            onHide: () => {
                this.isVisible = false;
            }
        });
    },

    /**
     * Настройка обработчиков шага 2
     */
    setupStep2Handlers() {
        setTimeout(() => {
            // Переключение типа получателя
            const radios = document.querySelectorAll('input[name="recipient_type"]');
            const selectFriendBtn = document.getElementById('gift-select-friend-btn');
            const selectedFriendText = document.getElementById('gift-selected-friend-text');
            const recipientHiddenInput = document.getElementById('gift-recipient-id');
            const radioLabels = document.querySelectorAll('.gift-option-radio');

            radios.forEach((radio, index) => {
                radio.addEventListener('change', () => {
                    // Обновляем стили радиокнопок
                    radioLabels.forEach(label => {
                        label.classList.remove('checked');
                    });
                    if (radio.checked) {
                        radioLabels[index].classList.add('checked');
                    }

                    if (radio.value === 'specific') {
                        selectFriendBtn.disabled = false;
                    } else {
                        selectFriendBtn.disabled = true;
                        recipientHiddenInput.value = '';
                        if (selectedFriendText) {
                            selectedFriendText.textContent = 'Выбрать друга';
                        }
                        this.giftData.recipient_user_id = null;
                    }
                });

                // Инициализируем стили для выбранной радиокнопки
                if (radio.checked) {
                    radioLabels[index].classList.add('checked');
                }
            });

            // Обработчик кнопки выбора друга
            if (selectFriendBtn) {
                selectFriendBtn.addEventListener('click', () => {
                    this.selectFriend();
                });
            }

            // Обновление данных
            const senderNameInput = document.getElementById('gift-sender-name');
            const messageInput = document.getElementById('gift-message');

            if (senderNameInput) {
                senderNameInput.addEventListener('input', () => {
                    this.giftData.sender_display_name = senderNameInput.value.trim() || null;
                });
            }

            if (messageInput) {
                messageInput.addEventListener('input', () => {
                    this.giftData.message = messageInput.value.trim() || null;
                });
            }
        }, 100);
    },

    /**
     * Шаг 3: Сводка
     */
    showStep3() {
        const service = this.selectedService;
        const recipientType = this.giftData.recipient_user_id ? 'Конкретному пользователю' : 'Без указания получателя';
        
        // Получаем имя друга, если оно было выбрано
        let recipientInfo = 'Будет создан код активации';
        if (this.giftData.recipient_user_id) {
            // Пытаемся получить текст из элемента, если он существует
            try {
                const selectedFriendTextEl = document.getElementById('gift-selected-friend-text');
                if (selectedFriendTextEl && selectedFriendTextEl.textContent && selectedFriendTextEl.textContent !== 'Выбрать друга') {
                    recipientInfo = selectedFriendTextEl.textContent;
                } else {
                    recipientInfo = `ID: ${this.giftData.recipient_user_id}`;
                }
            } catch (e) {
                recipientInfo = `ID: ${this.giftData.recipient_user_id}`;
            }
        }

        const content = `
            <div class="gift-flow-step gift-step-3">
                <div class="gift-summary">
                    <div class="gift-summary-section">
                        <h4 class="gift-summary-title">
                            <i class="fas fa-gift"></i>
                            Что дарите
                        </h4>
                        <div class="gift-summary-item">
                            <span class="gift-summary-label">Услуга:</span>
                            <span class="gift-summary-value">${service.name}</span>
                        </div>
                        <div class="gift-summary-item">
                            <span class="gift-summary-label">Срок:</span>
                            <span class="gift-summary-value">${service.duration}</span>
                        </div>
                        <div class="gift-summary-item">
                            <span class="gift-summary-label">Цена:</span>
                            <span class="gift-summary-value gift-price">${Utils.formatPrice(service.price)}</span>
                        </div>
                    </div>

                    <div class="gift-summary-section">
                        <h4 class="gift-summary-title">
                            <i class="fas fa-user"></i>
                            Кому
                        </h4>
                        <div class="gift-summary-item">
                            <span class="gift-summary-label">Тип:</span>
                            <span class="gift-summary-value">${recipientType}</span>
                        </div>
                        ${this.giftData.recipient_user_id ? `
                            <div class="gift-summary-item">
                                <span class="gift-summary-label">Информация:</span>
                                <span class="gift-summary-value">${recipientInfo}</span>
                            </div>
                        ` : ''}
                        ${this.giftData.sender_display_name ? `
                            <div class="gift-summary-item">
                                <span class="gift-summary-label">От кого:</span>
                                <span class="gift-summary-value">${this.giftData.sender_display_name}</span>
                            </div>
                        ` : ''}
                        ${this.giftData.message ? `
                            <div class="gift-summary-item gift-summary-message">
                                <span class="gift-summary-label">Сообщение:</span>
                                <span class="gift-summary-value">${Utils.escapeHtml(this.giftData.message)}</span>
                            </div>
                        ` : ''}
                    </div>

                    <div class="gift-summary-note">
                        <i class="fas fa-info-circle"></i>
                        <p>Обратите внимание: подарок не будет автоматически продлеваться. После окончания срока действия подписка завершится.</p>
                    </div>
                </div>
            </div>
        `;

        // Закрываем предыдущее модальное окно и создаем новое
        if (this.modalId) {
            window.Modal.close(this.modalId);
        }

        // Создаем новое модальное окно для шага 3
        this.modalId = window.Modal.show({
            title: 'Подарить подписку',
            content: content,
            size: 'large',
            closable: true,
            buttons: [
                {
                    id: 'back',
                    text: 'Назад',
                    action: 'custom',
                    handler: () => {
                        this.showStep2();
                        return false;
                    }
                },
                {
                    id: 'pay',
                    text: 'Перейти к оплате',
                    type: 'primary',
                    action: 'custom',
                    handler: () => {
                        this.handlePayment();
                        return false;
                    }
                }
            ],
            onShow: () => {
                this.isVisible = true;
            },
            onCancel: () => {
                this.hide();
            },
            onHide: () => {
                this.isVisible = false;
            }
        });
    },

    /**
     * Создание подарка и переход к оплате
     */
    async handlePayment() {
        try {
            if (window.Loading) {
                window.Loading.show('Создание подарка...');
            }

            // Валидация
            if (this.giftData.sender_display_name) {
                const namePattern = /^[a-zA-Zа-яА-ЯёЁ\s]+$/;
                if (!namePattern.test(this.giftData.sender_display_name)) {
                    if (window.Loading) window.Loading.hide();
                    if (window.Toast) {
                        window.Toast.error('Имя может содержать только буквы и пробелы');
                    }
                    return;
                }
            }

            // Создаем подарок
            const response = await window.GiftAPI.createGift({
                service_id: this.giftData.service_id,
                recipient_user_id: this.giftData.recipient_user_id || null,
                message: this.giftData.message || null,
                sender_display_name: this.giftData.sender_display_name || null
            });

            if (window.Loading) {
                window.Loading.hide();
            }

            // Закрываем модалку
            this.hide();

            // Переходим к оплате
            const paymentUrl = response.payment?.confirmation_url || response.confirmation_url;
            if (paymentUrl) {
                if (window.TelegramApp) {
                    window.TelegramApp.openLink(paymentUrl);
                } else {
                    window.open(paymentUrl, '_blank');
                }

                // Сохраняем платеж для мониторинга
                if (response.payment?.payment_id && window.PaymentMonitor) {
                    window.PaymentMonitor.addPayment(response.payment.payment_id);
                }

                if (window.Toast) {
                    window.Toast.success('Переход к оплате...');
                }
            } else {
                throw new Error('Не получен URL для оплаты');
            }

        } catch (error) {
            if (window.Loading) {
                window.Loading.hide();
            }

            Utils.log('error', 'Failed to create gift:', error);
            if (window.Toast) {
                const message = error.message || 'Ошибка создания подарка';
                window.Toast.error(message);
            }
        }
    },

    /**
     * Скрыть процесс подарка
     */
    hide() {
        if (this.modalId) {
            window.Modal.close(this.modalId);
            this.modalId = null;
        }
        this.isVisible = false;
        this.currentStep = 1;
        this.resetGiftData();
    },

    /**
     * Вычисление месячной цены
     */
    calculateMonthlyPrice(service) {
        // Парсим продолжительность более надежно
        const duration = service.duration || service.duration_days;

        let months = 1;
        if (typeof duration === 'string') {
            const durationMap = {
                '1 месяц': 1,
                '3 месяца': 3,
                '6 месяцев': 6,
                '12 месяцев': 12
            };
            months = durationMap[duration] || 1;
        } else if (typeof duration === 'number') {
            // Если duration_days приходит как число дней
            months = Math.max(1, Math.round(duration / 30));
        }

        return Math.round((service.price || 0) / months);
    }
};

