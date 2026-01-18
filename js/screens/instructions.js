// Instructions Screen for Dragon VPN Mini App

window.InstructionsScreen = {
    isVisible: false,
    currentStep: 0,
    deviceType: null,
    modal: null,

    async show(params = {}) {
        this.isVisible = true;
        this.currentStep = 0;
        this.deviceType = null;

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

        // Вибрация открытия
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }
    },

    createModal() {
        return Utils.createElement('div', {
            id: 'instructionsModal',
            className: 'modal-overlay'
        });
    },

    render() {
        if (!this.modal) return;


        this.modal.innerHTML = `
            <div class="modal modal-instructions">
                <div class="modal-header">
                    <div class="modal-title">
                        <i class="fas fa-book"></i>
                        Инструкции по настройке (Шаг ${this.currentStep + 1}/3)
                    </div>
                    <button class="modal-close" id="instructionsClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="steps-indicator">
                        ${this.renderStepsIndicator()}
                    </div>

                    <div class="step-content">
                        ${this.renderCurrentStep()}
                    </div>
                </div>
                <div class="modal-actions">
                    ${this.currentStep > 0 ? '<button class="btn btn-secondary" id="instructionsPrev">Назад</button>' : '<button class="btn btn-outline" id="instructionsSkip">Пропустить</button>'}
                    <button class="btn btn-primary" id="instructionsNext" ${this.currentStep === 0 && !this.deviceType ? 'disabled' : ''}>
                        ${this.currentStep === 2 ? 'Завершить' : 'Далее'}
                    </button>
                </div>
            </div>
        `;

        // Настраиваем обработчики событий ПОСЛЕ создания HTML
        this.setupEventListeners();
    },

    renderStepsIndicator() {
        const steps = ['Устройство', 'Приложение', 'Настройка'];
        return steps.map((step, index) => {
            const isActive = index === this.currentStep;
            const isCompleted = index < this.currentStep;
            const stepClass = isActive ? 'active' : isCompleted ? 'completed' : '';

            return `
                <div class="step-dot ${stepClass}"></div>
                ${index < steps.length - 1 ? `<div class="step-line ${isCompleted ? 'completed' : ''}"></div>` : ''}
            `;
        }).join('');
    },

    renderCurrentStep() {
        switch(this.currentStep) {
            case 0: return this.renderDeviceSelection();
            case 1: return this.renderAppDownload();
            case 2: return this.renderProfileSetup();
            default: return '<p>Шаг не найден</p>';
        }
    },

    renderDeviceSelection() {
        return `
            <div class="step-header">
                <h3>Выберите ваше устройство</h3>
            </div>

            <div class="device-grid">
                <div class="device-card ${this.deviceType === 'android' ? 'selected' : ''}" data-device="android">
                    <i class="fab fa-android"></i>
                    <span>Android</span>
                </div>
                <div class="device-card ${this.deviceType === 'ios' ? 'selected' : ''}" data-device="ios">
                    <i class="fab fa-apple"></i>
                    <span>iOS</span>
                </div>
                <div class="device-card ${this.deviceType === 'windows' ? 'selected' : ''}" data-device="windows">
                    <i class="fab fa-windows"></i>
                    <span>Windows</span>
                </div>
                <div class="device-card ${this.deviceType === 'macos' ? 'selected' : ''}" data-device="macos">
                    <i class="fab fa-apple"></i>
                    <span>macOS</span>
                </div>
            </div>
        `;
    },

    renderAppDownload() {
        if (!this.deviceType) {
            return '<p>Сначала выберите устройство</p>';
        }

        const appInfo = this.getAppInfo(this.deviceType);

        return `
            <div class="step-header">
                <h3>Скачайте приложение</h3>
            </div>

            <div class="app-download">
                <div class="app-icon">
                    <i class="${appInfo.icon}"></i>
                </div>
                <div class="app-info">
                    <h4>${appInfo.name}</h4>
                    <p>${appInfo.description}</p>
                </div>
                <button class="btn btn-primary" id="downloadApp" data-url="${appInfo.downloadUrl}">
                    <i class="fas fa-download"></i>
                    Скачать
                </button>
            </div>

            <div class="download-note">
                <i class="fas fa-info-circle"></i>
                <span>После установки приложения нажмите "Далее"</span>
            </div>
        `;
    },

    renderProfileSetup() {
        if (!this.deviceType) {
            return '<p>Сначала выберите устройство и скачайте приложение</p>';
        }

        return `
            <div class="step-header">
                <h3>Настройка профиля</h3>
                <p>Активируйте VPN профиль для вашего приложения</p>
            </div>

            <div class="profile-setup">
                <div class="profile-activation">
                    <div class="profile-actions">
                        <button class="btn btn-activation" id="activateProfile">
                            <i class="fas fa-magic"></i>
                            Активировать профиль
                        </button>
                        <button class="btn btn-outline" id="getKeys">
                            <i class="fas fa-key"></i>
                            Получить ключи вручную
                        </button>
                    </div>
                </div>
            </div>

            <div class="support-note">
                <i class="fas fa-question-circle"></i>
                <span>Возникли проблемы? </span>
                <button class="btn-link" id="contactSupport">Обратитесь в поддержку</button>
            </div>
        `;
    },

    async activateProfile() {
        try {
            // Получаем активную подписку с config_link
            const configLink = await this.getActiveSubscriptionConfig();

            if (!configLink) {
                if (window.Toast) {
                    window.Toast.error('Не найдена активная подписка с конфигурацией');
                }
                return;
            }

            // Генерируем ссылку для активации
            const activationUrl = this.generateActivationUrl(configLink);

            // Открываем ссылку
            if (window.TelegramApp) {
                window.TelegramApp.openLink(activationUrl);
            } else {
                window.open(activationUrl, '_blank');
            }

            // Показываем уведомление
            if (window.Toast) {
                window.Toast.success('Профиль отправлен в приложение!');
            }

            // Вибрация успеха
            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

        } catch (error) {
            if (window.Toast) {
                window.Toast.error('Ошибка активации профиля. Попробуйте получить ключи вручную.');
            }
        }
    },

    async getActiveSubscriptionConfig() {
        try {
            // Получаем подписки пользователя
            if (!window.SubscriptionAPI) {
                throw new Error('SubscriptionAPI not available');
            }

            const response = await window.SubscriptionAPI.listSubscriptions();
            const subscriptions = response.subscriptions || [];

            // Ищем активную подписку с config_link
            const activeSubscription = subscriptions.find(sub => {
                const daysLeft = Utils.daysBetween(sub.end_date);
                return daysLeft > 0 &&
                       (sub.status === 'active' || sub.status === 'trial') &&
                       sub.config_link;
            });

            if (activeSubscription) {
                return activeSubscription.config_link;
            }

            throw new Error('No active subscription with config found');

        } catch (error) {
            throw error;
        }
    },

    generateActivationUrl(configLink) {
        const platformMap = {
            'android': 'android',
            'ios': 'iphone',
            'windows': 'windows',
            'macos': 'macos'
        };

        const platform = platformMap[this.deviceType] || 'android';
        const baseUrl = 'http://skydragonvpn.ru/import';

        return `${baseUrl}/${platform}/${configLink}`;
    },

    getAppInfo(deviceType) {
        const apps = {
            android: {
                name: 'V2RayTUN',
                description: 'Официальное приложение V2RayTUN для Android',
                icon: 'fab fa-android',
                downloadUrl: 'https://play.google.com/store/apps/details?id=com.v2raytun.android&hl=ru'
            },
            ios: {
                name: 'Streisand',
                description: 'Официальное приложение Streisand для iOS',
                icon: 'fab fa-apple',
                downloadUrl: 'https://apps.apple.com/us/app/streisand/id6450534064'
            },
            windows: {
                name: 'Dragon VPN Client',
                description: 'Клиент DragonVPN для Windows',
                icon: 'fab fa-windows',
                downloadUrl: 'http://skydragonvpn.ru/download/windows'
            },
            macos: {
                name: 'Dragon VPN Client',
                description: 'Клиент DragonVPN для macOS',
                icon: 'fab fa-apple',
                downloadUrl: 'http://skydragonvpn.ru/download/macos'
            }
        };

        return apps[deviceType] || apps.android;
    },

    setupEventListeners() {
        if (!this.modal) return;

        // Закрытие модального окна
        const closeBtn = this.modal.querySelector('#instructionsClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            });
        }

        // Навигация между шагами
        const nextBtn = this.modal.querySelector('#instructionsNext');
        const prevBtn = this.modal.querySelector('#instructionsPrev');
        const skipBtn = this.modal.querySelector('#instructionsSkip');

        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.nextStep();
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.prevStep();
            });
        }

        if (skipBtn) {
            skipBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            });
        }

        const activateBtn = this.modal.querySelector('#activateProfile');
        if (activateBtn) {
            activateBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.activateProfile();
            });
        }

        // Выбор устройства
        const deviceCards = this.modal.querySelectorAll('.device-card');
        deviceCards.forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const device = card.dataset.device;
                this.selectDevice(device);
            });
        });

        // Скачивание приложения
        const downloadBtn = this.modal.querySelector('#downloadApp');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = downloadBtn.dataset.url;
                this.downloadApp(url);
            });
        }

        // Получение ключей
        const getKeysBtn = this.modal.querySelector('#getKeys');
        if (getKeysBtn) {
            getKeysBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.goToKeys();
            });
        }

        // Обращение в поддержку
        const supportBtn = this.modal.querySelector('#contactSupport');
        if (supportBtn) {
            supportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.contactSupport();
            });
        }

        // Закрытие по клику вне модала
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // Закрытие по Escape
        this.escapeHandler = (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    },

    selectDevice(deviceType) {
        this.deviceType = deviceType;

        // Обновляем UI БЕЗ полного перерендера
        const cards = this.modal.querySelectorAll('.device-card');
        cards.forEach(card => {
            card.classList.toggle('selected', card.dataset.device === deviceType);
        });

        // Включаем кнопку "Далее"
        const nextBtn = this.modal.querySelector('#instructionsNext');
        if (nextBtn) {
            nextBtn.disabled = false;
        }

        // Вибрация выбора
        if (window.TelegramApp) {
            window.TelegramApp.haptic.selection();
        }
    },

    nextStep() {

        // Проверяем можно ли перейти дальше с текущего шага
        if (this.currentStep === 0 && !this.deviceType) {
            if (window.Toast) {
                window.Toast.warning('Выберите устройство');
            }
            return;
        }

        // Сначала увеличиваем шаг
        this.currentStep++;

        // Проверяем на завершение после увеличения
        if (this.currentStep > 2) {
            // Завершение инструкций (после шага 3)
            this.completeInstructions();
            return;
        }

        // Переход к следующему шагу
        this.render();

        // Вибрация
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }
    },

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.render();
        }

        // Вибрация
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }
    },

    downloadApp(url) {
        // Открываем ссылку на скачивание
        if (window.TelegramApp) {
            window.TelegramApp.openLink(url);
        } else {
            window.open(url, '_blank');
        }

        // Вибрация
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }
    },

    goToKeys() {
        this.hide();
        if (window.Router) {
            window.Router.navigate('keys');
        }
    },

    contactSupport() {
        this.hide();
        if (window.Router) {
            window.Router.navigate('support');
        }
    },

    completeInstructions() {
        // Сохраняем состояние завершения
        if (window.Storage) {
            window.Storage.setInstructionsState({
                completed: true,
                device_type: this.deviceType,
                completed_at: Date.now()
            });
        }

        this.hide();
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
        // Убираем обработчик Escape
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }

        this.modal = null;
        this.currentStep = 0;
        this.deviceType = null;
    }
};