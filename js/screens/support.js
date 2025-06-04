window.SupportScreen = {
    isVisible: false,
    modal: null,

    async show(params = {}) {
        this.isVisible = true;

        // Закрываем предыдущий модаль если есть
        if (this.modal) {
            this.hide();
        }

        this.modal = this.createModal();
        document.body.appendChild(this.modal);

        setTimeout(() => {
            this.modal.classList.add('active');
        }, 10);

        this.render();
        this.setupEventListeners();

        // Вибрация открытия
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }
    },

    createModal() {
        return Utils.createElement('div', {
            id: 'supportModal',
            className: 'modal-overlay'
        });
    },

    render() {
        if (!this.modal) return;

        this.modal.innerHTML = `
            <div class="modal modal-support">
                <div class="modal-header">
                    <div class="modal-title">
                        <i class="fas fa-headset"></i>
                        Техническая поддержка
                    </div>
                    <button class="modal-close" id="supportClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <!-- Быстрые ответы -->
                    <div class="quick-answers">
                        <h4>Часто задаваемые вопросы</h4>
                        <div class="faq-list">
                            <div class="faq-item" data-faq="connection">
                                <i class="fas fa-wifi"></i>
                                <span>Проблемы с подключением</span>
                                <i class="fas fa-chevron-right"></i>
                            </div>
                            <div class="faq-item" data-faq="speed">
                                <i class="fas fa-tachometer-alt"></i>
                                <span>Низкая скорость</span>
                                <i class="fas fa-chevron-right"></i>
                            </div>
                            <div class="faq-item" data-faq="setup">
                                <i class="fas fa-cog"></i>
                                <span>Настройка приложения</span>
                                <i class="fas fa-chevron-right"></i>
                            </div>
                            <div class="faq-item" data-faq="billing">
                                <i class="fas fa-credit-card"></i>
                                <span>Вопросы по оплате</span>
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                    </div>

                    <!-- Форма обращения -->
                    <div class="support-form">
                        <h4>Написать в поддержку</h4>
                        <form id="supportForm">
                            <div class="form-group">
                                <label class="form-label">Тип обращения</label>
                                <select class="form-select" name="type" required>
                                    <option value="">Выберите тип</option>
                                    <option value="technical">Техническая проблема</option>
                                    <option value="billing">Вопрос по оплате</option>
                                    <option value="feature">Предложение по улучшению</option>
                                    <option value="account">Проблемы с аккаунтом</option>
                                    <option value="other">Другое</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Опишите проблему</label>
                                <textarea class="form-textarea" name="message" required
                                    placeholder="Подробно опишите вашу проблему или вопрос. Укажите какие действия вы уже предпринимали."
                                    rows="4"></textarea>
                            </div>

                            <!-- Системная информация -->
                            <div class="form-group">
                                <div class="system-info">
                                    <i class="fas fa-info-circle"></i>
                                    <span>Системная информация будет автоматически добавлена для диагностики</span>
                                </div>
                            </div>
                        </form>
                    </div>

                    <!-- Контакты -->
                    <div class="support-contacts">
                        <h4>Другие способы связи</h4>
                        <div class="contact-methods">
                            <div class="contact-item" id="telegramSupport">
                                <i class="fab fa-telegram"></i>
                                <div class="contact-info">
                                    <span class="contact-title">Telegram</span>
                                    <span class="contact-detail">@dragonvpn_support</span>
                                </div>
                            </div>
                            <div class="contact-item" id="emailSupport">
                                <i class="fas fa-envelope"></i>
                                <div class="contact-info">
                                    <span class="contact-title">Email</span>
                                    <span class="contact-detail">support@dragonvpn.com</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="supportCancel">Отмена</button>
                    <button class="btn btn-primary" id="supportSubmit">
                        <i class="fas fa-paper-plane"></i>
                        Отправить
                    </button>
                </div>
            </div>
        `;

        this.setupEventListeners();
    },

    setupEventListeners() {
        if (!this.modal) return;

        // Закрытие модального окна
        const closeBtn = this.modal.querySelector('#supportClose');
        const cancelBtn = this.modal.querySelector('#supportCancel');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hide());
        }

        // Отправка формы
        const submitBtn = this.modal.querySelector('#supportSubmit');
        const form = this.modal.querySelector('#supportForm');

        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitForm());
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitForm();
            });
        }

        // FAQ
        const faqItems = this.modal.querySelectorAll('.faq-item');
        faqItems.forEach(item => {
            item.addEventListener('click', () => {
                const faqType = item.dataset.faq;
                this.showFAQ(faqType);
            });
        });

        // Контакты
        const telegramBtn = this.modal.querySelector('#telegramSupport');
        const emailBtn = this.modal.querySelector('#emailSupport');

        if (telegramBtn) {
            telegramBtn.addEventListener('click', () => this.openTelegram());
        }

        if (emailBtn) {
            emailBtn.addEventListener('click', () => this.openEmail());
        }

        // Закрытие по клику вне модала
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', this.handleEscapeKey.bind(this));
    },

    async submitForm() {
        const form = this.modal.querySelector('#supportForm');
        if (!form) return;

        const formData = new FormData(form);
        const data = {
            type: formData.get('type'),
            message: formData.get('message'),
            user_info: this.getUserInfo(),
            timestamp: new Date().toISOString()
        };

        // Валидация
        if (!data.type || !data.message.trim()) {
            if (window.Toast) {
                window.Toast.warning('Заполните все обязательные поля');
            }
            return;
        }

        try {
            if (window.Loading) {
                window.Loading.show('Отправка обращения...');
            }

            // Отправка на сервер (заглушка)
            await this.sendSupportRequest(data);

            if (window.Loading) {
                window.Loading.hide();
            }

            if (window.Toast) {
                window.Toast.success('Обращение отправлено! Мы ответим в течение 24 часов.');
            }

            this.hide();

        } catch (error) {
            if (window.Loading) {
                window.Loading.hide();
            }

            if (window.Toast) {
                window.Toast.error('Ошибка отправки. Попробуйте позже или свяжитесь с нами напрямую.');
            }

            Utils.log('error', 'Failed to send support request:', error);
        }
    },

    async sendSupportRequest(data) {
        // Здесь будет реальный API вызов
        // Пока симулируем отправку
        return new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
    },

    getUserInfo() {
        const telegramUser = window.TelegramApp?.getUserInfo();
        const platform = Utils.getPlatform();

        return {
            telegram_id: telegramUser?.id,
            username: telegramUser?.username,
            first_name: telegramUser?.first_name,
            platform: platform,
            user_agent: navigator.userAgent,
            app_version: '1.0.0',
            timestamp: Date.now()
        };
    },

    showFAQ(type) {
        const faqContent = this.getFAQContent(type);

        if (window.Modal) {
            window.Modal.showAlert(faqContent.title, faqContent.content);
        }
    },

    getFAQContent(type) {
        const faqs = {
            connection: {
                title: 'Проблемы с подключением',
                content: `1. Проверьте интернет соединение\n2. Перезапустите VPN приложение\n3. Попробуйте другой сервер\n4. Проверьте настройки брандмауэра`
            },
            speed: {
                title: 'Низкая скорость',
                content: `1. Выберите ближайший сервер\n2. Смените протокол на WireGuard\n3. Закройте лишние приложения\n4. Проверьте ограничения провайдера`
            },
            setup: {
                title: 'Настройка приложения',
                content: `1. Скачайте WireGuard из официального магазина\n2. Импортируйте конфигурационный файл\n3. Нажмите подключиться\n4. Разрешите VPN соединение`
            },
            billing: {
                title: 'Вопросы по оплате',
                content: `1. Платежи обрабатываются автоматически\n2. При проблемах обратитесь в поддержку\n3. Возврат возможен в течение 7 дней\n4. Проверьте историю платежей в приложении`
            }
        };

        return faqs[type] || { title: 'Помощь', content: 'Информация не найдена' };
    },

    openTelegram() {
        const telegramUrl = 'https://t.me/dragonvpn_support';

        if (window.TelegramApp) {
            window.TelegramApp.openTelegramLink(telegramUrl);
        } else {
            window.open(telegramUrl, '_blank');
        }
    },

    openEmail() {
        const email = 'support@dragonvpn.com';
        const subject = 'Поддержка Dragon VPN';
        const body = 'Опишите вашу проблему:';

        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
    },

    handleEscapeKey(e) {
        if (e.key === 'Escape' && this.isVisible) {
            this.hide();
        }
    },

    hide() {
        if (!this.modal) return;

        this.modal.classList.remove('active');
        setTimeout(() => {
            if (this.modal && this.modal.parentNode) {
                this.modal.parentNode.removeChild(this.modal);
            }
            this.cleanup();
        }, 300);

        this.isVisible = false;
    },

    cleanup() {
        this.modal = null;

        // Убираем обработчик Escape
        document.removeEventListener('keydown', this.handleEscapeKey.bind(this));
    }
};