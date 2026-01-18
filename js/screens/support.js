window.SupportScreen = {
    isVisible: false,
    modal: null,
    currentView: 'main',
    currentFAQ: null,
    escapeHandler: null,

    async show(params = {}) {
        this.isVisible = true;
        this.currentView = 'main';
        this.currentFAQ = null;

        if (this.modal) {
            this.hide();
        }

        this.modal = this.createModal();
        document.body.appendChild(this.modal);

        setTimeout(() => {
            this.modal.classList.add('active');
        }, 10);

        this.render();

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

        if (this.currentView === 'faq') {
            this.renderFAQView();
        } else {
            this.renderMainView();
        }

        this.setupEventListeners();
    },

    renderMainView() {
        this.modal.innerHTML = `
            <div class="modal modal-support">
                <div class="modal-header">
                    <div class="modal-title">
                        <i class="fas fa-headset"></i>
                        Поддержка
                    </div>
                    <button class="modal-close" id="supportClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <!-- FAQ -->
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
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="supportCancel">Закрыть</button>
                    <button class="btn btn-primary" id="contactTechSupport">
                        <i class="fas fa-paper-plane"></i>
                        Написать в поддержку
                    </button>
                </div>
            </div>
        `;
    },

    renderFAQView() {
        const faqContent = this.getFAQContent(this.currentFAQ);

        this.modal.innerHTML = `
            <div class="modal modal-support">
                <div class="modal-header">
                    <div class="modal-title">
                        <i class="fas fa-question-circle"></i>
                        ${faqContent.title}
                    </div>
                    <button class="modal-close" id="supportClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="faq-content">
                        ${this.formatFAQContent(faqContent.content)}
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="faqBack">
                        <i class="fas fa-arrow-left"></i>
                        Назад
                    </button>
                    <button class="btn btn-primary" id="contactTechSupport">
                        <i class="fas fa-paper-plane"></i>
                        Написать в поддержку
                    </button>
                </div>
            </div>
        `;
    },

    formatFAQContent(content) {
        const steps = content.split('\n').filter(step => step.trim());
        return `
            <div class="faq-steps">
                ${steps.map(step => `
                    <div class="faq-step">
                        <i class="fas fa-check-circle"></i>
                        <span>${step}</span>
                    </div>
                `).join('')}
            </div>
        `;
    },

    setupEventListeners() {
        if (!this.modal) return;

        const closeBtn = this.modal.querySelector('#supportClose');
        const cancelBtn = this.modal.querySelector('#supportCancel');

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            });
        }

        const techSupportBtn = this.modal.querySelector('#contactTechSupport');
        if (techSupportBtn) {
            techSupportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.contactTechSupport();
            });
        }

        const faqItems = this.modal.querySelectorAll('.faq-item');
        faqItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const faqType = item.dataset.faq;
                this.showFAQ(faqType);
            });
        });

        const backBtn = this.modal.querySelector('#faqBack');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showMainView();
            });
        }

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        this.escapeHandler = (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                if (this.currentView === 'faq') {
                    this.showMainView();
                } else {
                    this.hide();
                }
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    },

    contactTechSupport() {
        const telegramUrl = 'https://t.me/SkyDragonSupport';

        if (window.TelegramApp) {
            window.TelegramApp.openTelegramLink(telegramUrl);
        } else {
            window.open(telegramUrl, '_blank');
        }

        this.hide();
    },

    showFAQ(type) {
        this.currentFAQ = type;
        this.currentView = 'faq';
        this.render();

        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }
    },

    showMainView() {
        this.currentView = 'main';
        this.currentFAQ = null;
        this.render();

        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
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
                content: `1. Выберите ближайший сервер\n2. Смените протокол\n3. Закройте лишние приложения\n4. Проверьте ограничения провайдера`
            },
            setup: {
                title: 'Настройка приложения',
                content: `1. Скачайте приложение из официального магазина\n2. Активируйте профиль через инструкции\n3. Нажмите подключиться\n4. Разрешите VPN соединение`
            },
            billing: {
                title: 'Вопросы по оплате',
                content: `1. Платежи обрабатываются автоматически\n2. При проблемах обратитесь в поддержку\n3. Возврат возможен в течение 7 дней\n4. Проверьте историю платежей в приложении`
            }
        };

        return faqs[type] || { title: 'Помощь', content: 'Информация не найдена' };
    },

    hide() {
        if (!this.modal) return;

        this.modal.classList.remove('active');
        setTimeout(() => {
            if (this.modal && this.modal.parentNode) {
                this.modal.parentNode.removeChild(this.modal);
            }
            this.cleanup();
        }, 150); // Уменьшено с 300ms до 150ms для быстрого закрытия

        this.isVisible = false;
    },

    cleanup() {
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }

        this.modal = null;
        this.currentView = 'main';
        this.currentFAQ = null;
    }
};