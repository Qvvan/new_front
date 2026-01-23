// Instructions Screen for Dragon VPN Mini App

window.InstructionsScreen = {
    isVisible: false,
    currentStep: 0,
    deviceType: null,
    modal: null,
    importLinks: null,
    subscriptionId: null,
    showSubscriptionSelection: false, // Флаг для показа выбора подписки внутри модального окна
    availableSubscriptions: [], // Доступные подписки для выбора

    async show(params = {}) {
        // Закрываем предыдущее модальное окно если есть (как в support.js)
        if (this.modal) {
            this.hide();
        }
        
        // ✅ Сохраняем экран, с которого открывается модальное окно
        if (window.Router) {
            this._openedFromScreen = window.Router.getCurrentScreen();
        }
        
        // ✅ Флаг для защиты от автоматического закрытия при deep link
        this.isDeepLinkOpen = !!(params.step !== undefined || params.device || params.activate || params.code || params.config_link);
        
        // Устанавливаем isVisible в true ПОСЛЕ закрытия предыдущего модального окна
        this.isVisible = true;
        
        // ✅ Обработка параметров из deep link
        // step: номер шага (0, 1, 2)
        const stepParam = params.step || params.step_number;
        if (stepParam !== undefined) {
            const stepNum = parseInt(stepParam, 10);
            if (stepNum >= 0 && stepNum <= 2) {
                this.currentStep = stepNum;
            } else {
                this.currentStep = 0;
            }
        } else {
            // Всегда начинаем с шага 0 при открытии инструкций
            this.currentStep = 0;
        }

        // device: тип устройства (android, ios, windows, macos)
        const deviceParam = params.device || params.device_type;
        if (deviceParam && ['android', 'ios', 'windows', 'macos'].includes(deviceParam)) {
            this.deviceType = deviceParam;
        } else {
            this.deviceType = null;
        }

        // activate/code: код активации профиля
        const activationCode = params.activate || params.code || params.config_link;
        if (activationCode) {
            // Если есть код активации, сразу переходим на шаг 3 (настройка профиля)
            this.currentStep = 2;
            // Сохраняем код для последующей активации
            this.pendingActivationCode = activationCode;
        } else {
            this.pendingActivationCode = null;
        }

        // Получаем subscription_id из параметров
        this.subscriptionId = params.subscription_id || params.subscriptionId;
        
        // Создаем модальное окно СРАЗУ, чтобы показать выбор подписки внутри него
        this.modal = this.createModal();
        document.body.appendChild(this.modal);
        
        // Показываем модальное окно
        const delay = this.isDeepLinkOpen ? 100 : 10;
        setTimeout(() => {
            if (this.modal) {
                this.modal.classList.add('active');
            }
        }, delay);
        
        // Если subscription_id не передан, проверяем количество подписок
        if (!this.subscriptionId) {
            const subscriptions = await this.getAllSubscriptions();
            
            if (subscriptions.length === 0) {
                // Нет подписок - показываем сообщение о покупке внутри модального окна
                this.showSubscriptionSelection = true;
                this.availableSubscriptions = [];
                this.render();
                return;
            }
            
            if (subscriptions.length === 1) {
                // Одна подписка - используем её
                const subscription = subscriptions[0];
                this.subscriptionId = subscription.subscription_id || subscription.id;
                
                // Проверяем активна ли она
                const daysLeft = Utils.daysBetween(subscription.end_date);
                const isActive = daysLeft > 0 && (subscription.status === 'active' || subscription.status === 'trial');
                
                if (!isActive) {
                    // Подписка неактивна - показываем выбор продления внутри модального окна
                    this.showSubscriptionSelection = true;
                    this.availableSubscriptions = subscriptions;
                    this.render();
                    return;
                }
                // Если подписка активна - продолжаем с инструкциями (showSubscriptionSelection = false)
            } else {
                // Несколько подписок - показываем выбор внутри модального окна
                this.showSubscriptionSelection = true;
                this.availableSubscriptions = subscriptions;
                this.render();
                return;
            }
        }
        
        console.log('[Instructions] subscription_id:', this.subscriptionId);
        
        // Если subscription_id есть, скрываем выбор подписки и показываем инструкции
        this.showSubscriptionSelection = false;

        // Загружаем import-links если subscription_id есть
        if (this.subscriptionId && !this.showSubscriptionSelection) {
            await this.loadImportLinks(this.subscriptionId);
            console.log('[Instructions] importLinks loaded:', this.importLinks);
        } else if (!this.subscriptionId) {
            console.warn('[Instructions] No subscription_id found');
        }

        // Рендерим содержимое (выбор подписки или инструкции)
        this.render();

        // ✅ Обновляем URL при открытии инструкций
        if (window.Router && !window.Router.isDeepLinkActive) {
            const urlParams = {
                step: this.currentStep
            };
            if (this.deviceType) {
                urlParams.device = this.deviceType;
            }
            if (this.pendingActivationCode) {
                urlParams.activate = this.pendingActivationCode;
            }
            window.Router.updateURL('instructions', urlParams);
        }

        // ✅ Если есть код активации, автоматически активируем профиль
        if (this.pendingActivationCode) {
            setTimeout(() => {
                if (this.isVisible && this.modal) { // Проверяем что модальное окно еще открыто
                    this.activateProfileByCode(this.pendingActivationCode);
                }
            }, 500); // Небольшая задержка для рендеринга
        }

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

        // Если нужно показать выбор подписки, показываем его
        if (this.showSubscriptionSelection) {
            this.modal.innerHTML = `
                <div class="modal modal-instructions">
                    <div class="modal-header">
                        <div class="modal-title">
                            <i class="fas fa-book"></i>
                            Выберите подписку
                        </div>
                        <button class="modal-close" id="instructionsClose">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${this.renderSubscriptionSelection()}
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" id="instructionsCancel">Отмена</button>
                    </div>
                </div>
            `;
        } else {
            // Показываем обычные инструкции
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
                        ${this.currentStep === 1 && this.getAppsForDevice(this.deviceType) && this.getAppsForDevice(this.deviceType).length > 0 ? '' : `<button class="btn btn-primary" id="instructionsNext" ${this.currentStep === 0 && !this.deviceType ? 'disabled' : ''}>
                            ${this.currentStep === 2 ? 'Завершить' : 'Далее'}
                        </button>`}
                    </div>
                </div>
            `;
        }

        // Настраиваем обработчики событий ПОСЛЕ создания HTML
        this.setupEventListeners();
    },

    renderSubscriptionSelection() {
        if (this.availableSubscriptions.length === 0) {
            // Нет подписок
            return `
                <div class="subscription-selection-content">
                    <div class="subscription-selection-message">
                        <i class="fas fa-info-circle"></i>
                        <p>У вас нет активной подписки. Для просмотра инструкций необходимо приобрести подписку.</p>
                    </div>
                    <button class="btn btn-primary" id="buySubscription">
                        <i class="fas fa-shopping-cart"></i>
                        Купить подписку
                    </button>
                </div>
            `;
        }

        if (this.availableSubscriptions.length === 1) {
            // Одна подписка - показываем информацию о ней
            const subscription = this.availableSubscriptions[0];
            const daysLeft = Utils.daysBetween(subscription.end_date);
            const isActive = daysLeft > 0 && (subscription.status === 'active' || subscription.status === 'trial');
            
            if (!isActive) {
                // Подписка неактивна - предлагаем продлить
                return `
                    <div class="subscription-selection-content">
                        <div class="subscription-selection-message">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>${daysLeft <= 0 ? 'Ваша подписка просрочена.' : 'Ваша подписка истекает.'}</p>
                            <p>Для просмотра инструкций необходимо продлить подписку.</p>
                        </div>
                        <button class="btn btn-primary" id="renewSubscription" data-subscription-id="${subscription.subscription_id || subscription.id}">
                            <i class="fas fa-sync-alt"></i>
                            Продлить подписку
                        </button>
                    </div>
                `;
            }
        }

        // Несколько подписок - показываем список
        const subscriptionOptions = this.availableSubscriptions.map((sub) => {
            const subId = sub.subscription_id || sub.id;
            const daysLeft = Utils.daysBetween(sub.end_date);
            const serviceName = sub.service_name || `Подписка ${subId}`;
            const isActive = daysLeft > 0 && (sub.status === 'active' || sub.status === 'trial');
            const statusText = isActive 
                ? 'Активна' 
                : daysLeft <= 0 
                    ? 'Просрочена' 
                    : `Истекает через ${daysLeft} ${Utils.pluralize(daysLeft, ['день', 'дня', 'дней'])}`;
            
            return `
                <div class="subscription-option ${isActive ? 'subscription-active' : 'subscription-expired'}" data-subscription-id="${subId}">
                    <div class="subscription-option-info">
                        <h4>${Utils.escapeHtml(serviceName)}</h4>
                        <p class="subscription-status ${isActive ? 'status-active' : 'status-expired'}">${statusText}</p>
                    </div>
                    <button class="btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-select-subscription" 
                            data-subscription-id="${subId}" 
                            data-is-active="${isActive}">
                        ${isActive ? 'Выбрать' : 'Продлить'}
                    </button>
                </div>
            `;
        }).join('');

        return `
            <div class="subscription-selection-content">
                <div class="subscription-selection-message">
                    <p>У вас несколько подписок. Выберите подписку, для которой хотите посмотреть инструкции:</p>
                </div>
                <div class="subscriptions-list">
                    ${subscriptionOptions}
                </div>
            </div>
        `;
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
            case 1: {
                // Для шага 2 нужно асинхронно загрузить данные если нужно
                const content = this.renderAppDownloadSync();
                // Если данных нет, пытаемся загрузить асинхронно
                if (!this.importLinks && this.subscriptionId) {
                    this.loadImportLinks(this.subscriptionId).then(() => {
                        this.render();
                    });
                }
                return content;
            }
            case 2: return this.renderProfileSetup();
            default: return '<p>Шаг не найден</p>';
        }
    },

    renderAppDownloadSync() {
        if (!this.deviceType) {
            return '<p>Сначала выберите устройство</p>';
        }

        const apps = this.getAppsForDevice(this.deviceType);
        console.log('[Instructions] renderAppDownloadSync - deviceType:', this.deviceType, 'apps:', apps, 'importLinks:', this.importLinks);
        
        if (!apps || apps.length === 0) {
            // Fallback на старые данные
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
        }

        return `
            <div class="step-header">
                <h3>Скачайте приложение</h3>
            </div>

            <div class="apps-list">
                ${apps.map((app, index) => `
                    <div class="app-card" data-app-index="${index}">
                        <div class="app-icon">
                            <i class="${this.getAppIcon(app.app_name)}"></i>
                        </div>
                        <div class="app-info">
                            <h4>${Utils.escapeHtml(app.app_name)}</h4>
                        </div>
                        <button class="btn btn-primary btn-download-app" data-url="${Utils.escapeHtml(app.store_url)}" data-import-url="${Utils.escapeHtml(app.import_url)}">
                            <i class="fas fa-download"></i>
                            Скачать
                        </button>
                    </div>
                `).join('')}
            </div>

            <div class="download-note">
                <i class="fas fa-info-circle"></i>
                <span>После установки требуется настройка профиля</span>
            </div>
        `;
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

    /**
     * Активация профиля по коду из deep link
     */
    async activateProfileByCode(code) {
        try {
            if (!code) {
                return;
            }

            // Определяем тип устройства если не указан
            if (!this.deviceType) {
                // Пытаемся определить по user agent или используем android по умолчанию
                const ua = navigator.userAgent.toLowerCase();
                if (ua.includes('iphone') || ua.includes('ipad')) {
                    this.deviceType = 'ios';
                } else if (ua.includes('windows')) {
                    this.deviceType = 'windows';
                } else if (ua.includes('mac')) {
                    this.deviceType = 'macos';
                } else {
                    this.deviceType = 'android';
                }
            }

            // Генерируем ссылку для активации
            const activationUrl = this.generateActivationUrl(code);

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

    async activateProfile() {
        try {
            // Используем сохраненный import_url если был выбран конкретный
            let importUrl = this.selectedImportUrl;
            console.log('[Instructions] activateProfile - selectedImportUrl:', importUrl);

            // Если не выбран конкретный, берем первый доступный
            if (!importUrl) {
                importUrl = this.getImportUrlForDevice(this.deviceType);
                console.log('[Instructions] activateProfile - using first available:', importUrl);
            }

            if (!importUrl) {
                // Fallback на старый метод
                const configLink = await this.getActiveSubscriptionConfig();
                if (!configLink) {
                    if (window.Toast) {
                        window.Toast.error('Не найдена активная подписка с конфигурацией');
                    }
                    return;
                }
                const activationUrl = this.generateActivationUrl(configLink);
                this.openActivationUrl(activationUrl);
                return;
            }

            // Открываем ссылку для активации
            this.openActivationUrl(importUrl);

        } catch (error) {
            if (window.Toast) {
                window.Toast.error('Ошибка активации профиля. Попробуйте получить ключи вручную.');
            }
        }
    },

    openActivationUrl(url) {
        // Открываем ссылку
        if (window.TelegramApp) {
            window.TelegramApp.openLink(url);
        } else {
            window.open(url, '_blank');
        }

        // Показываем уведомление
        if (window.Toast) {
            window.Toast.success('Профиль отправлен в приложение!');
        }

        // Вибрация успеха
        if (window.TelegramApp) {
            window.TelegramApp.haptic.success();
        }
    },

    async checkActiveSubscription() {
        // Проверяем наличие активной подписки
        if (window.SubscriptionScreen && window.SubscriptionScreen.currentSubscriptions) {
            const activeSubscription = window.SubscriptionScreen.currentSubscriptions.find(sub => {
                const daysLeft = Utils.daysBetween(sub.end_date);
                return daysLeft > 0 && (sub.status === 'active' || sub.status === 'trial');
            });
            
            return !!activeSubscription;
        }
        
        // Если нет данных в SubscriptionScreen, проверяем через API
        try {
            if (!window.SubscriptionAPI) {
                return false;
            }
            
            const response = await window.SubscriptionAPI.listSubscriptions();
            const subscriptions = response.subscriptions || [];
            
            const activeSubscription = subscriptions.find(sub => {
                const daysLeft = Utils.daysBetween(sub.end_date);
                return daysLeft > 0 && (sub.status === 'active' || sub.status === 'trial');
            });
            
            return !!activeSubscription;
        } catch (error) {
            console.warn('[Instructions] Failed to check active subscription:', error);
            return false;
        }
    },

    async getAllSubscriptions() {
        // Получаем все подписки (активные и неактивные)
        try {
            if (window.SubscriptionScreen && window.SubscriptionScreen.currentSubscriptions) {
                return window.SubscriptionScreen.currentSubscriptions;
            }
            
            if (!window.SubscriptionAPI) {
                return [];
            }
            
            const response = await window.SubscriptionAPI.listSubscriptions();
            return response.subscriptions || [];
        } catch (error) {
            console.warn('[Instructions] Failed to get subscriptions:', error);
            return [];
        }
    },

    async showSubscriptionSelectionModalForInstructions(subscriptions) {
        return new Promise(async (resolve) => {
            if (subscriptions.length === 0) {
                resolve(null);
                return;
            }
            
            if (subscriptions.length === 1) {
                // Одна подписка - возвращаем её ID
                const subscription = subscriptions[0];
                resolve(subscription.subscription_id || subscription.id);
                return;
            }
            
            // Несколько подписок - показываем выбор
            const subscriptionOptions = subscriptions.map((sub, index) => {
                const subId = sub.subscription_id || sub.id;
                const daysLeft = Utils.daysBetween(sub.end_date);
                const serviceName = sub.service_name || `Подписка ${subId}`;
                const isActive = daysLeft > 0 && (sub.status === 'active' || sub.status === 'trial');
                const statusText = isActive 
                    ? 'Активна' 
                    : daysLeft <= 0 
                        ? 'Просрочена' 
                        : `Истекает через ${daysLeft} ${Utils.pluralize(daysLeft, ['день', 'дня', 'дней'])}`;
                
                return `
                    <div class="subscription-option ${isActive ? 'subscription-active' : 'subscription-expired'}" data-subscription-id="${subId}">
                        <div class="subscription-option-info">
                            <h4>${Utils.escapeHtml(serviceName)}</h4>
                            <p class="subscription-status ${isActive ? 'status-active' : 'status-expired'}">${statusText}</p>
                        </div>
                        <button class="btn ${isActive ? 'btn-primary' : 'btn-primary'} btn-select-subscription" 
                                data-subscription-id="${subId}" 
                                data-is-active="${isActive}">
                            ${isActive ? 'Выбрать' : 'Продлить'}
                        </button>
                    </div>
                `;
            }).join('');
            
            if (window.Modal) {
                // Временно скрываем модалку инструкций если она уже создана
                let instructionsModalHidden = false;
                if (this.modal) {
                    this.modal.style.display = 'none';
                    instructionsModalHidden = true;
                }
                
                window.Modal.show({
                    title: 'Выберите подписку',
                    content: `
                        <div class="subscription-selection-message">
                            <p>У вас несколько подписок. Выберите подписку, для которой хотите посмотреть инструкции:</p>
                            <div class="subscriptions-list">
                                ${subscriptionOptions}
                            </div>
                        </div>
                    `,
                    buttons: [
                        {
                            id: 'cancel',
                            text: 'Отмена',
                            action: 'close',
                            handler: () => {
                                // Восстанавливаем модалку инструкций если была скрыта
                                if (instructionsModalHidden && this.modal) {
                                    this.modal.style.display = '';
                                }
                                resolve(null);
                            }
                        }
                    ],
                    onShow: () => {
                        // Настраиваем обработчики для кнопок выбора
                        setTimeout(() => {
                            const selectButtons = document.querySelectorAll('.btn-select-subscription');
                            selectButtons.forEach(btn => {
                                btn.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    const subscriptionId = btn.dataset.subscriptionId;
                                    const isActive = btn.dataset.isActive === 'true';
                                    
                                    // Если подписка неактивна - открываем модалку продления
                                    if (!isActive) {
                                        window.Modal.hide();
                                        
                                        // Восстанавливаем модалку инструкций если была скрыта
                                        if (instructionsModalHidden && this.modal) {
                                            this.modal.style.display = '';
                                        }
                                        
                                        // Показываем модалку продления
                                        this.renewSubscription(subscriptionId);
                                        
                                        resolve(null);
                                        return;
                                    }
                                    
                                    // Если подписка активна - продолжаем
                                    window.Modal.hide();
                                    
                                    // Восстанавливаем модалку инструкций если была скрыта
                                    if (instructionsModalHidden && this.modal) {
                                        this.modal.style.display = '';
                                    }
                                    
                                    resolve(subscriptionId);
                                });
                            });
                        }, 100);
                    },
                    onHide: () => {
                        // Восстанавливаем модалку инструкций если была скрыта
                        if (instructionsModalHidden && this.modal) {
                            this.modal.style.display = '';
                        }
                    }
                });
            } else {
                resolve(null);
            }
        });
    },

    async showSubscriptionSelectionModal() {
        return new Promise(async (resolve) => {
            const subscriptions = await this.getAllSubscriptions();
            
            if (subscriptions.length === 0) {
                // Нет подписок вообще - предлагаем купить новую
                if (window.Modal) {
                    window.Modal.show({
                        title: 'Нет активной подписки',
                        content: `
                            <div class="subscription-expired-message">
                                <p>У вас нет активной подписки. Для просмотра инструкций необходимо приобрести подписку.</p>
                            </div>
                        `,
                        buttons: [
                            {
                                id: 'buy',
                                text: 'Купить подписку',
                                type: 'primary',
                                handler: () => {
                                    if (window.ServiceSelector) {
                                        window.ServiceSelector.show('buy');
                                    }
                                    resolve(null);
                                }
                            },
                            {
                                id: 'cancel',
                                text: 'Отмена',
                                action: 'close',
                                handler: () => resolve(null)
                            }
                        ]
                    });
                } else {
                    resolve(null);
                }
                return;
            }
            
            if (subscriptions.length === 1) {
                // Одна подписка - сразу предлагаем продлить
                const subscription = subscriptions[0];
                const subscriptionId = subscription.subscription_id || subscription.id;
                const daysLeft = Utils.daysBetween(subscription.end_date);
                
                if (window.Modal) {
                    window.Modal.show({
                        title: 'Подписка просрочена',
                        content: `
                            <div class="subscription-expired-message">
                                <p>${daysLeft <= 0 ? 'Ваша подписка просрочена.' : 'Ваша подписка истекает.'}</p>
                                <p>Для просмотра инструкций необходимо продлить подписку.</p>
                            </div>
                        `,
                        buttons: [
                            {
                                id: 'renew',
                                text: 'Продлить',
                                type: 'primary',
                                handler: () => {
                                    resolve(subscriptionId);
                                }
                            },
                            {
                                id: 'cancel',
                                text: 'Отмена',
                                action: 'close',
                                handler: () => resolve(null)
                            }
                        ]
                    });
                } else {
                    resolve(subscriptionId);
                }
                return;
            }
            
            // Несколько подписок - показываем выбор
            const subscriptionOptions = subscriptions.map((sub, index) => {
                const subId = sub.subscription_id || sub.id;
                const daysLeft = Utils.daysBetween(sub.end_date);
                const serviceName = sub.service_name || `Подписка ${subId}`;
                const statusText = daysLeft <= 0 ? 'Просрочена' : `Истекает через ${daysLeft} ${Utils.pluralize(daysLeft, ['день', 'дня', 'дней'])}`;
                
                return `
                    <div class="subscription-option" data-subscription-id="${subId}">
                        <div class="subscription-option-info">
                            <h4>${Utils.escapeHtml(serviceName)}</h4>
                            <p class="subscription-status">${statusText}</p>
                        </div>
                        <button class="btn btn-primary btn-select-subscription" data-subscription-id="${subId}">
                            Выбрать
                        </button>
                    </div>
                `;
            }).join('');
            
            if (window.Modal) {
                const modal = window.Modal.show({
                    title: 'Выберите подписку',
                    content: `
                        <div class="subscription-selection-message">
                            <p>У вас нет активной подписки. Выберите подписку, которую хотите продлить для просмотра инструкций:</p>
                            <div class="subscriptions-list">
                                ${subscriptionOptions}
                            </div>
                        </div>
                    `,
                    buttons: [
                        {
                            id: 'cancel',
                            text: 'Отмена',
                            action: 'close',
                            handler: () => resolve(null)
                        }
                    ],
                    onShow: () => {
                        // Настраиваем обработчики для кнопок выбора
                        setTimeout(() => {
                            const selectButtons = document.querySelectorAll('.btn-select-subscription');
                            selectButtons.forEach(btn => {
                                btn.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const subscriptionId = btn.dataset.subscriptionId;
                                    window.Modal.hide();
                                    resolve(subscriptionId);
                                });
                            });
                        }, 100);
                    }
                });
            } else {
                resolve(null);
            }
        });
    },

    async renewSubscription(subscriptionId) {
        // Продлеваем подписку через ServiceSelector
        if (window.ServiceSelector) {
            await window.ServiceSelector.show('renew', subscriptionId);
            // После продления обновляем данные подписок
            if (window.SubscriptionScreen) {
                await window.SubscriptionScreen.refresh();
            }
        }
    },

    getSubscriptionIdFromState() {
        // Пытаемся получить subscription_id из SubscriptionScreen
        if (window.SubscriptionScreen && window.SubscriptionScreen.currentSubscriptions) {
            const activeSubscription = window.SubscriptionScreen.currentSubscriptions.find(sub => {
                const daysLeft = Utils.daysBetween(sub.end_date);
                return daysLeft > 0 && (sub.status === 'active' || sub.status === 'trial');
            });
            
            if (activeSubscription) {
                return activeSubscription.subscription_id || activeSubscription.id;
            }
        }
        return null;
    },

    async loadImportLinks(subscriptionId) {
        try {
            if (!window.SubscriptionAPI || !subscriptionId) {
                console.warn('[Instructions] Cannot load import links - API or subscriptionId missing');
                return;
            }

            console.log('[Instructions] Loading import links for subscription_id:', subscriptionId);
            
            // Загружаем import-links напрямую
            const importLinksResponse = await window.SubscriptionAPI.getImportLinks(subscriptionId);
            
            console.log('[Instructions] Import links response:', importLinksResponse);
            
            // Проверяем структуру ответа
            if (importLinksResponse && typeof importLinksResponse === 'object') {
                this.importLinks = importLinksResponse;
                console.log('[Instructions] Import links loaded successfully:', {
                    iphone: this.importLinks.iphone?.length || 0,
                    android: this.importLinks.android?.length || 0,
                    windows: this.importLinks.windows?.length || 0,
                    macos: this.importLinks.macos?.length || 0
                });
            } else {
                console.warn('[Instructions] Invalid import links response format');
                this.importLinks = null;
            }
        } catch (error) {
            console.error('[Instructions] Failed to load import links:', error);
            this.importLinks = null;
        }
    },

    getAppsForDevice(deviceType) {
        if (!this.importLinks) {
            return null;
        }

        const platformMap = {
            'android': 'android',
            'ios': 'iphone',
            'windows': 'windows',
            'macos': 'macos'
        };

        const platform = platformMap[deviceType];
        if (!platform || !this.importLinks[platform]) {
            return null;
        }

        return this.importLinks[platform];
    },

    getImportUrlForDevice(deviceType) {
        const apps = this.getAppsForDevice(deviceType);
        if (!apps || apps.length === 0) {
            return null;
        }

        // Используем первый доступный import_url
        return apps[0].import_url;
    },

    getAppIcon(appName) {
        const iconMap = {
            'v2RayTun': 'fas fa-shield-alt',
            'Happ - Proxy Utility Plus': 'fas fa-network-wired',
            'Streisand': 'fas fa-lock'
        };

        // Ищем по частичному совпадению
        for (const [key, icon] of Object.entries(iconMap)) {
            if (appName.toLowerCase().includes(key.toLowerCase())) {
                return icon;
            }
        }

        // Иконка по умолчанию в зависимости от устройства
        if (this.deviceType === 'android') {
            return 'fab fa-android';
        } else if (this.deviceType === 'ios') {
            return 'fab fa-apple';
        } else if (this.deviceType === 'windows') {
            return 'fab fa-windows';
        } else if (this.deviceType === 'macos') {
            return 'fab fa-apple';
        }

        return 'fas fa-mobile-alt';
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

        // Если configLink уже полная ссылка, возвращаем как есть
        if (configLink && (configLink.startsWith('http://') || configLink.startsWith('https://'))) {
            return configLink;
        }

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

        // Скачивание приложения (fallback)
        const downloadBtn = this.modal.querySelector('#downloadApp');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = downloadBtn.dataset.url;
                
                // Открываем ссылку на скачивание
                this.downloadApp(url);
                
                // Сразу переходим на шаг 3 (настройка профиля)
                this.currentStep = 2;
                this.render();
                
                // Обновляем URL
                if (window.Router) {
                    const params = { step: this.currentStep };
                    if (this.deviceType) {
                        params.device = this.deviceType;
                    }
                    window.Router.updateURL('instructions', params);
                }
            });
        }

        // Скачивание приложений из списка
        const downloadBtns = this.modal.querySelectorAll('.btn-download-app');
        downloadBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = btn.dataset.url;
                const importUrl = btn.dataset.importUrl;
                
                // Сохраняем import_url для активации
                if (importUrl) {
                    this.selectedImportUrl = importUrl;
                    console.log('[Instructions] Selected import_url:', importUrl);
                }
                
                // Открываем ссылку на скачивание
                this.downloadApp(url);
                
                // Сразу переходим на шаг 3 (настройка профиля)
                this.currentStep = 2;
                console.log('[Instructions] Moving to step 3 after download');
                this.render();
                
                // Обновляем URL
                if (window.Router) {
                    const params = { step: this.currentStep };
                    if (this.deviceType) {
                        params.device = this.deviceType;
                    }
                    window.Router.updateURL('instructions', params);
                }
                
                // Вибрация
                if (window.TelegramApp) {
                    window.TelegramApp.haptic.light();
                }
            });
        });

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

        // Обработка выбора подписки
        const cancelBtn = this.modal.querySelector('#instructionsCancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            });
        }

        // Кнопка покупки подписки
        const buyBtn = this.modal.querySelector('#buySubscription');
        if (buyBtn) {
            buyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
                if (window.ServiceSelector) {
                    window.ServiceSelector.show('buy');
                }
            });
        }

        // Кнопка продления подписки (для одной подписки)
        const renewBtn = this.modal.querySelector('#renewSubscription');
        if (renewBtn) {
            renewBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const subscriptionId = renewBtn.dataset.subscriptionId;
                this.hide();
                await this.renewSubscription(subscriptionId);
            });
        }

        // Кнопки выбора подписки (для нескольких подписок)
        const selectBtns = this.modal.querySelectorAll('.btn-select-subscription');
        selectBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const subscriptionId = btn.dataset.subscriptionId;
                const isActive = btn.dataset.isActive === 'true';
                
                if (!isActive) {
                    // Подписка неактивна - продлеваем
                    this.hide();
                    await this.renewSubscription(subscriptionId);
                    // После продления открываем инструкции снова
                    const newSubscriptionId = this.getSubscriptionIdFromState() || subscriptionId;
                    if (newSubscriptionId) {
                        await this.show({ subscription_id: newSubscriptionId });
                    }
                } else {
                    // Подписка активна - продолжаем с инструкциями
                    this.subscriptionId = subscriptionId;
                    this.showSubscriptionSelection = false;
                    await this.loadImportLinks(this.subscriptionId);
                    this.render();
                }
            });
        });

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
        // Сбрасываем выбранный import_url при смене устройства
        this.selectedImportUrl = null;

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

        // ✅ Обновляем URL с выбранным устройством
        if (window.Router) {
            window.Router.updateURL('instructions', {
                device: deviceType,
                step: this.currentStep
            });
        }

        // Вибрация выбора
        if (window.TelegramApp) {
            window.TelegramApp.haptic.selection();
        }
    },

    async nextStep() {
        // Проверяем можно ли перейти дальше с текущего шага
        if (this.currentStep === 0 && !this.deviceType) {
            if (window.Toast) {
                window.Toast.warning('Выберите устройство');
            }
            return;
        }

        // Если переходим на шаг 2 (скачивание приложения), загружаем данные если нужно
        if (this.currentStep === 0 && this.deviceType) {
            if (!this.importLinks && this.subscriptionId) {
                await this.loadImportLinks(this.subscriptionId);
            }
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

        // ✅ Обновляем URL с новым шагом
        if (window.Router) {
            const params = { step: this.currentStep };
            if (this.deviceType) {
                params.device = this.deviceType;
            }
            window.Router.updateURL('instructions', params);
        }

        // Вибрация
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }
    },

    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            // Сбрасываем выбранный import_url при возврате на шаг 2
            if (this.currentStep === 1) {
                this.selectedImportUrl = null;
            }
            this.render();
            
            // ✅ Обновляем URL с новым шагом
            if (window.Router) {
                const params = { step: this.currentStep };
                if (this.deviceType) {
                    params.device = this.deviceType;
                }
                window.Router.updateURL('instructions', params);
            }
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

    /**
     * Закрытие модального окна инструкций
     * Точная копия логики из support.js
     */
    hide() {
        if (!this.modal) return;

        // Сохраняем ссылку на модальное окно для удаления (критично!)
        const modalToRemove = this.modal;
        
        // Удаляем класс active для анимации закрытия
        modalToRemove.classList.remove('active');
        
        // Удаляем элемент из DOM после анимации
        setTimeout(() => {
            // Проверяем что это именно то модальное окно, которое мы хотели удалить
            if (modalToRemove && modalToRemove.parentNode) {
                modalToRemove.parentNode.removeChild(modalToRemove);
            }
            // Вызываем cleanup только если это последнее модальное окно
            if (this.modal === modalToRemove) {
                this.cleanup();
            }
        }, 150);

        // Устанавливаем isVisible в false ПОСЛЕ setTimeout, как в support.js
        this.isVisible = false;
        
        // Возвращаемся на предыдущий экран при закрытии модального окна
        if (window.Router) {
            const openedFromScreen = this._openedFromScreen || window.Router.getPreviousScreen();
            this._openedFromScreen = null;
            
            if (openedFromScreen && openedFromScreen !== 'instructions') {
                window.Router.navigate(openedFromScreen, false);
            } else {
                window.Router.navigate('subscription', false);
            }
        }
    },

    /**
     * Полная очистка состояния после закрытия модального окна
     * Точная копия логики из support.js
     */
    cleanup() {
        // Убираем обработчик Escape
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }

        // Очистка состояния (БЕЗ установки isVisible = false, это делается в hide())
        // Важно: не очищаем this.modal если он указывает на новое модальное окно
        // (это может произойти если show() был вызван сразу после hide())
        if (!this.isVisible) {
            this.modal = null;
        }
        this.currentStep = 0;
        this.deviceType = null;
        this.pendingActivationCode = null;
        this.isDeepLinkOpen = false;
        this.importLinks = null;
        this.subscriptionId = null;
        this.selectedImportUrl = null;
        this._openedFromScreen = null;
        this.showSubscriptionSelection = false;
        this.availableSubscriptions = [];
    }
};