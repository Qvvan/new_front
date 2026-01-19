// Subscription Screen for Dragon VPN Mini App

window.SubscriptionScreen = {
    currentSubscriptions: [], // Только в памяти
    servicesCache: new Map(), // Сессионный кеш услуг
    isLoaded: false,
    currencyBalance: null, // Баланс валюты
    dailyBonusList: null, // Список бонусов

    /**
     * Инициализация экрана подписки
     */
    async init() {
        Utils.log('info', 'Initializing Subscription Screen');

        await this.loadUserData();
        await this.loadServices();
        await this.loadSubscriptions();
        await this.loadDailyBonusStatus();
        await this.loadCurrencyBalance();
        await this.loadDailyBonusList();
        await this.checkPendingGifts();

        this.render();
        this.setupEventListeners();
        this.isLoaded = true;
    },

    async loadUserData() {
        try {
            if (window.UserAPI) {
                const response = await window.UserAPI.getCurrentUser();
                this.userData = response.user || response;
                Utils.log('info', 'User data loaded for subscription screen:', this.userData);
            }
        } catch (error) {
            Utils.log('error', 'Failed to load user data:', error);
            this.userData = { trial_activated: false }; // Fallback
        }
    },

    /**
     * Загрузка и кеширование услуг
     */
    async loadServices() {
        try {
            if (window.ServiceAPI) {
                const response = await window.ServiceAPI.getServices();
                const services = Array.isArray(response) ? response : (response.services || []);

                services.forEach(service => {
                    // Сохраняем по service_id (приоритет) или id
                    const serviceId = service.service_id || service.id;
                    if (serviceId) {
                        this.servicesCache.set(serviceId, service);
                    }
                    // Также сохраняем по id, если он отличается от service_id
                    if (service.id && service.id !== serviceId) {
                        this.servicesCache.set(service.id, service);
                    }
                });

                Utils.log('info', `Cached ${services.length} services`);
            }
        } catch (error) {
            Utils.log('error', 'Failed to load services for caching:', error);
        }
    },

    /**
     * Загрузка подписок пользователя с API
     */
    async loadSubscriptions() {
        try {
            const response = await window.SubscriptionAPI.listSubscriptions();
            // Теперь API возвращает массив напрямую
            this.currentSubscriptions = Array.isArray(response) ? response : (response.subscriptions || []);

            if (window.Storage) {
                window.Storage.setSubscriptions(this.currentSubscriptions);
            }

            Utils.log('info', `Loaded ${this.currentSubscriptions.length} subscriptions`);

        } catch (error) {
            Utils.log('error', 'Failed to load subscriptions:', error);

            if (window.Storage) {
                this.currentSubscriptions = await window.Storage.getSubscriptions();
            }

            if (this.currentSubscriptions.length === 0) {
                this.isEmpty = true;
                if (window.Toast) {
                    window.Toast.error('Ошибка загрузки подписок');
                }
            }
        }
    },

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const subscriptionScreen = e.target.closest('#subscriptionScreen');
            if (!subscriptionScreen) return;

            // Пропускаем клики на автопродление - они обрабатываются отдельным обработчиком
            if (e.target.closest('.auto-renewal') || e.target.closest('.subscription-compact-auto-renewal')) {
                return;
            }

            const target = e.target.closest('[data-action]');
            if (!target) return;

            if (target.hasAttribute('data-processing')) return;
            target.setAttribute('data-processing', 'true');
            setTimeout(() => target.removeAttribute('data-processing'), 300);

            const action = target.dataset.action;
            const subscriptionId = target.dataset.subscriptionId;

            // Обработка действий верхней панели
            if (action === 'show-daily-bonus-modal') {
                this.showDailyBonusModal();
                return;
            }
            if (action === 'show-currency-info-modal') {
                this.showCurrencyInfoModal();
                return;
            }

            this.handleAction(action, subscriptionId);
        });

        document.addEventListener('click', (e) => {
            const subscriptionScreen = e.target.closest('#subscriptionScreen');
            if (!subscriptionScreen) return;

            // Проверяем клик на .auto-renewal или на элементы внутри него (включая toggle-switch)
            let autoRenewal = e.target.closest('.auto-renewal');
            
            // Если клик был на toggle-switch или его дочерних элементах, находим родительский .auto-renewal
            if (!autoRenewal) {
                const clickedElement = e.target;
                // Проверяем, является ли кликнутый элемент частью toggle-switch
                if (clickedElement.closest('.toggle-switch') || 
                    clickedElement.classList.contains('toggle-switch') || 
                    clickedElement.classList.contains('toggle-slider')) {
                    const toggleSwitch = clickedElement.closest('.toggle-switch') || clickedElement;
                    autoRenewal = toggleSwitch.closest('.auto-renewal');
                }
            }
            
            if (!autoRenewal) return;

            // Предотвращаем обработку если уже обрабатывается
            if (autoRenewal.hasAttribute('data-processing')) {
                return;
            }

            // Останавливаем всплытие, чтобы другие обработчики не сработали
            e.stopPropagation();
            e.preventDefault();

            autoRenewal.setAttribute('data-processing', 'true');
            setTimeout(() => autoRenewal.removeAttribute('data-processing'), 300);

            const subscriptionId = autoRenewal.dataset.subscriptionId;
            if (subscriptionId) {
                Utils.log('info', 'Auto renewal toggle clicked:', subscriptionId);
                this.handleAutoRenewalToggle(subscriptionId);
            }
        }, true); // Используем capture phase для более раннего перехвата

        document.addEventListener('click', (e) => {
            const subscriptionScreen = e.target.closest('#subscriptionScreen');
            if (!subscriptionScreen) return;

            // Проверяем клик на компактный автопродление или на элементы внутри него
            const compactAutoRenewal = e.target.closest('.subscription-compact-auto-renewal');
            if (!compactAutoRenewal) return;

            // Предотвращаем обработку если уже обрабатывается
            if (compactAutoRenewal.hasAttribute('data-processing')) {
                return;
            }

            // Останавливаем всплытие, чтобы другие обработчики не сработали
            e.stopPropagation();
            e.preventDefault();

            compactAutoRenewal.setAttribute('data-processing', 'true');
            setTimeout(() => compactAutoRenewal.removeAttribute('data-processing'), 300);

            const subscriptionId = compactAutoRenewal.dataset.subscriptionId;
            if (subscriptionId) {
                Utils.log('info', 'Compact auto renewal toggle clicked:', subscriptionId);
                this.handleAutoRenewalToggle(subscriptionId);
            }
        }, true); // Используем capture phase для более раннего перехвата
    },

    /**
     * Обработка действий
     */
    async handleAction(action, subscriptionId = null) {
        if (this.isProcessingAction) return;
        this.isProcessingAction = true;

        try {
            if (window.TelegramApp) {
                window.TelegramApp.haptic.light();
            }

            switch (action) {
                case 'renew':
                    await this.handleRenewSubscription(subscriptionId);
                    break;
                case 'buy':
                    await this.handleBuyNewSubscription();
                    break;
                case 'activate-trial':
                    await this.handleActivateTrial();
                    break;
                case 'claim-daily-bonus':
                    await this.handleClaimDailyBonus();
                    break;
                case 'instructions':
                    this.handleViewInstructions();
                    break;
                case 'support':
                    this.handleContactSupport();
                    break;
                case 'gift':
                    await this.handleGiftSubscription();
                    break;
                case 'activate-code':
                    await this.handleActivateCode();
                    break;
                case 'news-channel':
                    this.handleNewsChannel();
                    break;
                default:
                    Utils.log('warn', 'Unknown action:', action);
            }
        } finally {
            setTimeout(() => {
                this.isProcessingAction = false;
            }, 500);
        }
    },

    /**
     * Продление подписки
     */
    async handleRenewSubscription(subscriptionId) {
        Utils.log('info', 'Renewing subscription:', subscriptionId);

        if (window.ServiceSelector) {
            await window.ServiceSelector.show('renew', subscriptionId);
        }
    },

    /**
     * Покупка новой подписки
     */
    async handleBuyNewSubscription() {
        Utils.log('info', 'Buying new subscription');

        if (window.ServiceSelector) {
            await window.ServiceSelector.show('buy');
        }
    },

    /**
     * Активация пробного периода
     */
    async handleActivateTrial() {
        try {
            Utils.log('info', 'Requesting trial activation');

            // Показываем красивое модальное окно подтверждения
            const confirmed = await this.showTrialConfirmationModal();
            if (!confirmed) return;

            // Показываем загрузку
            if (window.Loading) {
                window.Loading.show('Активация пробного периода...');
            }

            // ✅ ИСПРАВЛЕНИЕ: Используем правильный API метод
            const response = await window.SubscriptionAPI.activateTrial();

            if (window.Loading) {
                window.Loading.hide();
            }

            // Показываем анимацию успеха
            await this.showTrialActivationAnimation();

            // Обновляем данные подписок
            await this.refresh();

            // ✅ Сразу показываем инструкции
            setTimeout(() => {
                if (window.InstructionsScreen) {
                    window.InstructionsScreen.show();
                }
            }, 1000);

            // Вибрация успеха
            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

        } catch (error) {
            Utils.log('error', 'Failed to activate trial:', error);

            if (window.Loading) {
                window.Loading.hide();
            }

            if (window.Toast) {
                const message = error.data?.comment || error.message || 'Ошибка активации пробного периода';
                window.Toast.error(message);
            }
        }
    },

    async showTrialConfirmationModal() {
        return new Promise((resolve) => {
            if (window.Modal) {
                window.Modal.show({
                    title: 'Активировать пробный период?',
                    size: 'medium',
                    content: `
                        <div class="trial-confirmation-content">
                            <div class="trial-confirmation-icon">
                                <div id="trial-confirmation-animation" style="width: 64px; height: 64px; margin: 0 auto;"></div>
                            </div>

                            <div class="trial-confirmation-details">
                                <h3>Бесплатный пробный период на 5 дней</h3>

                                <div class="trial-note">
                                    <i class="fas fa-info-circle"></i>
                                    <span>После окончания пробного периода подписка автоматически не продлится.</span>
                                </div>
                            </div>
                        </div>
                    `,
                    buttons: [
                        {
                            id: 'cancel',
                            text: 'Отмена',
                            action: 'cancel'
                        },
                        {
                            id: 'activate',
                            text: 'Активировать',
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
                    onHide: () => {
                        this.isProcessingAction = false;
                    },
                    onShow: () => {
                        // ✅ Инициализируем анимацию в модалке
                        setTimeout(() => {
                            if (window.TGSLoader) {
                                window.TGSLoader.loadTGSAnimation(
                                    'trial-confirmation-animation',
                                    'assets/images/gifs/gift-animate.tgs',
                                    'fas fa-gift'
                                );
                            }
                        }, 100);
                    }
                });
            } else {
                // Fallback для Telegram
                resolve(window.TelegramApp?.showConfirm(
                    'Активировать пробный период на 5 дней бесплатно?\n\nАвтопродление отключено.'
                ));
            }
        });
    },

    /**
     * Переключение автопродления
     */
    async handleAutoRenewalToggle(subscriptionId) {
        Utils.log('info', 'handleAutoRenewalToggle called with subscriptionId:', subscriptionId);
        
        // Преобразуем subscriptionId в число, если это строка
        const id = typeof subscriptionId === 'string' ? parseInt(subscriptionId, 10) : subscriptionId;
        
        const subscription = this.currentSubscriptions.find(s => {
            const subId = s.subscription_id || s.id;
            return subId === id || subId === subscriptionId;
        });
        
        if (!subscription) {
            Utils.log('error', 'Subscription not found:', { subscriptionId, id, subscriptions: this.currentSubscriptions });
            return;
        }

        Utils.log('info', 'Found subscription:', { 
            subscription_id: subscription.subscription_id || subscription.id,
            current_auto_renewal: subscription.auto_renewal 
        });

        const newAutoRenewal = !subscription.auto_renewal;
        Utils.log('info', 'New auto renewal value:', newAutoRenewal);

        try {
            const confirmed = await this.showAutoRenewalConfirmation(newAutoRenewal);
            Utils.log('info', 'Confirmation result:', confirmed);
            
            if (!confirmed) {
                Utils.log('info', 'User cancelled auto renewal change');
                return;
            }

            Utils.log('info', 'Updating auto renewal via API...');
            await window.SubscriptionAPI.updateAutoRenewal(id || subscriptionId, newAutoRenewal);

            subscription.auto_renewal = newAutoRenewal;

            Utils.log('info', 'Updating UI...');
            this.updateAutoRenewalUI(id || subscriptionId, newAutoRenewal);

            if (window.Toast) {
                const message = newAutoRenewal
                    ? 'Автопродление включено'
                    : 'Автопродление отключено';
                window.Toast.success(message);
            }

            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

        } catch (error) {
            Utils.log('error', 'Failed to update auto renewal:', error);

            if (window.Toast) {
                const message = error.data?.comment || error.message || 'Ошибка изменения автопродления';
                window.Toast.error(message);
            }
        }
    },

    /**
     * Показ подтверждения автопродления
     */
    async showAutoRenewalConfirmation(enable) {
        const title = enable ? 'Включить автопродление?' : 'Выключить автопродление?';
        const message = enable
            ? 'При включении автопродления ваша подписка будет автоматически продлеваться за день до окончания действующего периода. Вы всегда можете отключить эту функцию.'
            : 'При отключении автопродления ваша подписка завершится в указанную дату. Вам потребуется продлить её вручную.';

        Utils.log('info', 'Showing auto renewal confirmation:', { enable, title });

        if (window.Modal && window.Modal.showConfirm) {
            try {
                const result = await window.Modal.showConfirm(title, message);
                Utils.log('info', 'Modal confirmation result:', result);
                return result;
            } catch (error) {
                Utils.log('error', 'Error showing modal confirmation:', error);
                // Fallback to Telegram
                if (window.TelegramApp && window.TelegramApp.showConfirm) {
                    return await window.TelegramApp.showConfirm(`${title}\n\n${message}`);
                }
                return false;
            }
        } else if (window.TelegramApp && window.TelegramApp.showConfirm) {
            const result = await window.TelegramApp.showConfirm(`${title}\n\n${message}`);
            Utils.log('info', 'Telegram confirmation result:', result);
            return result;
        } else {
            return true; // Fallback - разрешаем изменение
        }
    },

    /**
     * Просмотр инструкций
     */
    handleViewInstructions() {
        if (window.Router) {
            window.Router.navigate('instructions');
        }
    },

    /**
     * Обращение в поддержку
     */
    handleContactSupport() {
        if (window.Router) {
            window.Router.navigate('support');
        }
    },

    /**
     * Подарок подписки
     */
    async handleGiftSubscription() {
        Utils.log('info', 'Starting gift subscription flow');
        
        // Проверяем доступность компонента
        if (typeof window.GiftFlow === 'undefined' || !window.GiftFlow) {
            Utils.log('error', 'GiftFlow component not available', {
                type: typeof window.GiftFlow,
                exists: typeof window.GiftFlow !== 'undefined'
            });
            if (window.Toast) {
                window.Toast.error('Компонент подарков недоступен');
            }
            return;
        }

        try {
            await window.GiftFlow.show();
        } catch (error) {
            Utils.log('error', 'Failed to show gift flow:', error);
            if (window.Toast) {
                window.Toast.error('Ошибка открытия подарка');
            }
        }
    },

    /**
     * Активация кода подарка
     */
    async handleActivateCode() {
        Utils.log('info', 'Opening code activation modal');
        
        if (window.Modal) {
            await this.showCodeActivationModal();
        }
    },

    /**
     * Показ модального окна активации кода
     */
    async showCodeActivationModal() {
        return new Promise((resolve) => {
            const self = this; // Сохраняем контекст
            let isProcessing = false;
            
            if (window.Modal) {
                window.Modal.show({
                    title: 'Активировать код подарка',
                    size: 'medium',
                    content: `
                        <div class="code-activation-content">
                            <div class="code-activation-header">
                                <div class="code-activation-icon-wrapper">
                                    <div class="code-activation-icon-glow"></div>
                                    <i class="fas fa-gift code-activation-icon"></i>
                                </div>
                                <h3 class="code-activation-title">Введите код активации</h3>
                                <p class="code-activation-description">
                                    Получили подарок? Введите код и активируйте подписку
                                </p>
                            </div>
                            
                            <div class="code-input-container">
                                <div class="code-input-wrapper">
                                    <div class="code-input-border"></div>
                                    <input type="text" 
                                           id="giftCodeInput" 
                                           class="code-input" 
                                           placeholder="Введите код активации"
                                           autocomplete="off"
                                           spellcheck="false">
                                    <div class="code-input-focus-line"></div>
                                </div>
                                <div class="code-input-hint">
                                    <i class="fas fa-info-circle"></i>
                                    <span>Код может быть любой длины</span>
                                </div>
                            </div>
                            
                            <div id="codeActivationError" class="code-activation-error" style="display: flex; visibility: hidden; opacity: 0;">
                                <i class="fas fa-exclamation-circle"></i>
                                <span id="codeActivationErrorText"></span>
                            </div>
                        </div>
                    `,
                    buttons: [
                        {
                            id: 'cancel',
                            text: 'Отмена',
                            action: 'cancel'
                        },
                        {
                            id: 'activate',
                            text: 'Активировать',
                            type: 'primary',
                            action: 'custom',
                            closeAfter: false,
                            handler: async () => {
                                return await self.handleCodeActivation();
                            },
                            disabled: true
                        }
                    ],
                    onCancel: () => {
                        resolve(null);
                    },
                    onShow: () => {
                        setTimeout(() => {
                            const input = document.getElementById('giftCodeInput');
                            if (!input) return;
                            
                            // Фокус с небольшой задержкой для плавности
                            setTimeout(() => {
                                input.focus();
                            }, 100);
                            
                            const modal = input.closest('.modal');
                            
                            // Обработка ввода
                            const handleInput = (e) => {
                                // Разрешаем любые символы, но приводим к верхнему регистру
                                let value = e.target.value.toUpperCase();
                                
                                e.target.value = value;
                                
                                // Ищем кнопку в модальном окне
                                const activateBtn = modal ? modal.querySelector('button[data-button-id="activate"]') : null;
                                const errorDiv = document.getElementById('codeActivationError');
                                
                                // Скрываем ошибку при вводе
                                if (errorDiv) {
                                    errorDiv.style.opacity = '0';
                                    errorDiv.style.visibility = 'hidden';
                                }
                                
                                // Включаем/выключаем кнопку (минимум 1 символ)
                                if (activateBtn) {
                                    const trimmedValue = value.trim();
                                    const hasValue = trimmedValue.length > 0;
                                    
                                    if (hasValue) {
                                        activateBtn.disabled = false;
                                        activateBtn.classList.remove('btn-disabled');
                                        activateBtn.removeAttribute('disabled');
                                    } else {
                                        activateBtn.disabled = true;
                                        activateBtn.classList.add('btn-disabled');
                                        activateBtn.setAttribute('disabled', 'disabled');
                                    }
                                }
                                
                                // Обновляем стиль инпута
                                if (value.trim()) {
                                    input.classList.add('has-value');
                                } else {
                                    input.classList.remove('has-value');
                                }
                            };
                            
                            input.addEventListener('input', handleInput);

                            // Обработка Enter
                            input.addEventListener('keypress', async (e) => {
                                if (e.key === 'Enter') {
                                    const activateBtn = modal ? modal.querySelector('button[data-button-id="activate"]') : null;
                                    if (activateBtn && !activateBtn.disabled && !isProcessing) {
                                        e.preventDefault();
                                        isProcessing = true;
                                        try {
                                            await self.handleCodeActivation();
                                        } finally {
                                            isProcessing = false;
                                        }
                                    }
                                }
                            });
                            
                            // Обработка фокуса
                            input.addEventListener('focus', () => {
                                input.closest('.code-input-wrapper')?.classList.add('focused');
                            });
                            
                            input.addEventListener('blur', () => {
                                input.closest('.code-input-wrapper')?.classList.remove('focused');
                            });
                        }, 50);
                    }
                });
            } else {
                const code = prompt('Введите код активации:');
                resolve(code ? code.trim().toUpperCase() : null);
            }
        });
    },

    /**
     * Обработка активации кода (без закрытия модального окна)
     */
    async handleCodeActivation() {
        const input = document.getElementById('giftCodeInput');
        if (!input) {
            return 'keep-open';
        }
        
        const modal = input.closest('.modal');
        const errorDiv = document.getElementById('codeActivationError');
        const errorText = document.getElementById('codeActivationErrorText');
        const activateBtn = modal ? modal.querySelector('button[data-button-id="activate"]') : null;
        
        // Проверка на пустой ввод (код может быть любой длины, но не пустым)
        const code = input.value.trim().toUpperCase();
        
        if (!code) {
            if (errorDiv && errorText) {
                errorText.textContent = 'Вы не ввели код';
                errorDiv.style.display = 'flex';
            }
            if (window.TelegramApp && window.TelegramApp.haptic) {
                window.TelegramApp.haptic.notificationOccurred('error');
            }
            return 'keep-open';
        }
        
        // Блокируем повторные нажатия
        if (activateBtn) {
            activateBtn.disabled = true;
            activateBtn.setAttribute('disabled', 'disabled');
            activateBtn.classList.add('btn-disabled');
            const originalText = activateBtn.innerHTML;
            activateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Активация...';
            activateBtn.dataset.originalHtml = originalText;
        }
        
        try {
            if (window.Loading) {
                window.Loading.show('Активация кода...');
            }

            const response = await window.GiftAPI.activateGiftByCode(code);

            if (window.Loading) {
                window.Loading.hide();
            }

            // Скрываем ошибку если была
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }

            // Закрываем модальное окно активации только при успехе
            if (window.Modal) {
                window.Modal.closeTop();
            }

            // Показываем успешную активацию
            await this.showGiftActivationSuccess(response);

            // Обновляем данные
            await this.refresh();

            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

            return true; // Успех - можно закрыть

        } catch (error) {
            if (window.Loading) {
                window.Loading.hide();
            }
            
            // Приоритет: comment от бэкенда > message > общее сообщение
            const errorMessage = error.data?.comment || error.message || 'Ошибка активации кода';
            
            // Показываем ошибку в модальном окне (не закрываем его)
            if (errorDiv && errorText) {
                errorText.textContent = errorMessage;
                // Показываем через visibility и opacity (место уже зарезервировано)
                errorDiv.style.visibility = 'visible';
                requestAnimationFrame(() => {
                    errorDiv.style.opacity = '1';
                });
            }
            
            // Восстанавливаем кнопку
            if (activateBtn) {
                requestAnimationFrame(() => {
                    activateBtn.disabled = false;
                    activateBtn.removeAttribute('disabled');
                    activateBtn.classList.remove('btn-disabled');
                    activateBtn.innerHTML = activateBtn.dataset.originalHtml || 'Активировать';
                });
            }
            
            // Вибрация ошибки
            if (window.TelegramApp && window.TelegramApp.haptic) {
                window.TelegramApp.haptic.notificationOccurred('error');
            }
            
            // Фокус на инпут для повторной попытки
            if (input) {
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        input.focus();
                        input.select();
                    }, 50);
                });
            }
            
            return 'keep-open'; // Ошибка - не закрываем модальное окно
        }
    },

    /**
     * Показ успешной активации подарка
     */
    async showGiftActivationSuccess(giftData) {
        const serviceName = giftData.service_name || 'Подписка';
        const days = giftData.duration_days || giftData.service?.duration_days || 0;

        if (window.Modal) {
            window.Modal.show({
                title: 'Подарок активирован!',
                content: `
                    <div class="gift-activation-success">
                        <div class="gift-success-icon">
                            <i class="fas fa-check-circle" style="font-size: 64px; color: var(--color-success);"></i>
                        </div>
                        <h3>Вы получили подарок!</h3>
                        <p class="gift-success-details">
                            ${serviceName} на ${days} ${Utils.pluralize(days, ['день', 'дня', 'дней'])}
                        </p>
                        ${giftData.message ? `
                            <div class="gift-message">
                                <p><strong>Сообщение от дарителя:</strong></p>
                                <p>${Utils.escapeHtml(giftData.message)}</p>
                            </div>
                        ` : ''}
                    </div>
                `,
                buttons: [
                    {
                        id: 'instructions',
                        text: 'Инструкции',
                        type: 'primary',
                        handler: () => {
                            if (window.InstructionsScreen) {
                                window.InstructionsScreen.show();
                            }
                        }
                    },
                    {
                        id: 'close',
                        text: 'Закрыть',
                        action: 'close'
                    }
                ]
            });
        }
    },

    /**
     * Открытие канала с новостями
     */
    handleNewsChannel() {
        const newsChannelUrl = 'https://t.me/skydragonvpn'; // Замените на ваш канал
        
        if (window.TelegramApp) {
            window.TelegramApp.openLink(newsChannelUrl);
        } else {
            window.open(newsChannelUrl, '_blank');
        }

        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }
    },

    /**
     * Рендеринг экрана
     */
    render() {
        const container = document.getElementById('subscriptionScreen');
        if (!container) return;

        container.style.opacity = '0';
        container.style.transform = 'translateY(10px)';

        let content = this.renderTopBar();
        
        if (this.currentSubscriptions.length === 0) {
            content += this.renderEmptyState();
        } else if (this.currentSubscriptions.length === 1) {
            content += this.renderSingleSubscription(this.currentSubscriptions[0]);
        } else {
            content += this.renderMultipleSubscriptions();
        }

        content += this.renderBottomActions();
        content += this.renderQuickActions();

        container.innerHTML = Utils.wrapContent(content);

        requestAnimationFrame(() => {
            container.style.transition = 'all 0.2s ease-out';
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
            
            // Инициализируем TGS анимации после рендера
            setTimeout(() => {
                this.initializeTGSAnimations();
            }, 100);
        });
    },

    /**
     * Инициализация TGS анимаций после рендера
     */
    initializeTGSAnimations() {
        // ✅ Просто вызываем универсальный метод
        if (window.TGSLoader) {
            window.TGSLoader.initializeScreen('subscription');
        } else {
            Utils.log('error', 'TGSLoader not available');
        }
    },

    /**
     * Очистка TGS анимаций (для экономии памяти)
     */
    cleanupTGSAnimations() {
        // ✅ Просто вызываем универсальный cleanup
        if (window.TGSLoader) {
            window.TGSLoader.cleanupScreen('subscription');
        }
    },

    /**
     * Рендеринг пустого состояния
     */
    renderEmptyState() {
        // ✅ ПРАВИЛЬНАЯ проверка доступности пробного периода
        const isTrialAvailable = !this.userData?.trial_activated;
        const trialTgs = isTrialAvailable ?
            'assets/images/gifs/gift-animate.tgs' :
            'assets/images/gifs/gift-opened.png';

        // ⚠️ Планируем инициализацию анимаций ПОСЛЕ рендера DOM
        setTimeout(() => {
            this.initializeTGSAnimations();
        }, 100);

        return `
            <div class="empty-state-card">
                <div class="empty-state-content">
                    <div class="empty-state-icon-gif">
                        <div id="tgs-animation-container" style="width: 80px; height: 80px; margin: 0 auto;"></div>
                    </div>
                    <h3 class="empty-state-title">Нет активных подписок</h3>
                    <div class="empty-state-actions">
                        ${isTrialAvailable ? `
                            <button class="btn-trial-activation" data-action="activate-trial">
                                <div class="btn-trial-bg">
                                    <div class="btn-trial-shine"></div>
                                    <div class="btn-trial-glow"></div>
                                </div>
                                <div class="btn-trial-content">
                                    <div class="trial-icon-wrapper">
                                        <div id="trial-gift-tgs" style="width: 40px; height: 40px;"></div>
                                    </div>
                                    <div class="trial-text">
                                        <span class="trial-main">Пробный период</span>
                                        <span class="trial-sub">5 дней бесплатно</span>
                                    </div>
                                    <div class="trial-arrow">
                                        <i class="fas fa-arrow-right"></i>
                                    </div>
                                </div>
                            </button>
                        ` : `
                            <div class="trial-used-notice">
                                <div class="trial-used-icon">
                                    <div id="trial-used-tgs" style="width: 24px; height: 24px;" data-tgs="${trialTgs}"></div>
                                </div>
                                <span>Пробный период использован</span>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг одной подписки (полный формат)
     */
    renderSingleSubscription(subscription) {
        const daysLeft = Utils.daysBetween(subscription.end_date);
        const isExpired = daysLeft <= 0;
        const isTrial = this.isTrialSubscription(subscription);

        const statusClass = isExpired ? 'expired' : 'active';
        const statusText = isExpired ? 'Истекла' : 'Активна';

        const renewalDate = Utils.formatDate(subscription.end_date);
        const autoRenewalText = subscription.auto_renewal && !isExpired
            ? `Продление ${renewalDate}`
            : `Завершится ${renewalDate}`;

        const serviceName = this.getServiceName(subscription);

        return `
            <div class="card subscription-card" data-subscription-id="${subscription.subscription_id || subscription.id}">
                <div class="subscription-header">
                    <h2 class="subscription-title">
                        <i class="fas ${isTrial ? 'fa-gift' : 'fa-shield-alt'}"></i>
                        ${serviceName}
                    </h2>
                    <div class="subscription-status ${statusClass}">${statusText}</div>
                </div>

                <div class="subscription-info">
                    <div class="time-remaining">
                        <div class="days-left ${isExpired ? 'text-red' : ''}">${Math.abs(daysLeft)}</div>
                        <div class="days-label">
                            ${isExpired ? 'дней назад истекла' : Utils.pluralize(daysLeft, ['день остался', 'дня осталось', 'дней осталось'])}
                        </div>
                    </div>
                </div>

                    ${!isExpired && !isTrial ? `
                        <div class="auto-renewal" data-subscription-id="${subscription.subscription_id || subscription.id}">
                            <div class="auto-renewal-info">
                                <div class="auto-renewal-icon">
                                    <div id="auto-renewal-animation-${subscription.subscription_id || subscription.id}" style="width: 32px; height: 32px;"></div>
                                </div>
                                <div class="auto-renewal-text">
                                    <h4>Автопродление</h4>
                                    <p class="auto-renewal-status">${autoRenewalText}</p>
                                </div>
                            </div>
                            <div class="toggle-switch ${subscription.auto_renewal ? 'active' : ''}">
                                <div class="toggle-slider"></div>
                            </div>
                        </div>
                    ` : ''}

                <div class="subscription-actions">
                    <button class="btn-trial-activation btn-renew" data-action="renew" data-subscription-id="${subscription.subscription_id || subscription.id}">
                        <div class="btn-trial-bg">
                            <div class="btn-trial-shine"></div>
                            <div class="btn-trial-glow"></div>
                        </div>
                        <div class="btn-trial-content">
                            <div class="trial-icon-wrapper">
                                <i class="fas fa-sync-alt"></i>
                            </div>
                            <div class="trial-text">
                                <span class="trial-main">${isExpired ? 'Возобновить' : 'Продлить подписку'}</span>
                            </div>
                            <div class="trial-arrow">
                                <i class="fas fa-arrow-right"></i>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг нескольких подписок (компактный формат)
     */
    renderMultipleSubscriptions() {
        let content = '<div class="subscriptions-compact">';

        this.currentSubscriptions.forEach(subscription => {
            const daysLeft = Utils.daysBetween(subscription.end_date);
            const isExpired = daysLeft <= 0;
            const isTrial = this.isTrialSubscription(subscription);

            const statusClass = isExpired ? 'expired' : 'active';
            const statusText = isExpired ? 'Истекла' : 'Активна';

            const serviceName = this.getServiceName(subscription);

            content += `
                <div class="subscription-compact ${statusClass}" data-subscription-id="${subscription.subscription_id || subscription.id}">
                    <div class="subscription-compact-info">
                        <div class="subscription-compact-icon">
                            <i class="fas ${isTrial ? 'fa-gift' : 'fa-shield-alt'}"></i>
                        </div>
                        <div class="subscription-compact-details">
                            <h4>${serviceName}</h4>
                            <p>${statusText}</p>
                        </div>
                    </div>
                    <div class="subscription-compact-status">
                        <div class="subscription-compact-days ${isExpired ? 'text-red' : ''}">${Math.abs(daysLeft)}</div>
                        <div class="subscription-compact-label">
                            ${isExpired ? 'дн. назад' : 'дн. осталось'}
                        </div>
                    </div>
                    <div class="subscription-compact-actions">
                        ${!isTrial && !isExpired ? `
                            <div class="subscription-compact-auto-renewal"
                                 data-subscription-id="${subscription.id}"
                                 title="Автопродление">
                                <div class="toggle-switch-compact ${subscription.auto_renewal ? 'active' : ''}">
                                    <div class="toggle-slider-compact"></div>
                                </div>
                            </div>
                        ` : ''}
                        <button class="btn-trial-activation btn-renew-compact" data-action="renew" data-subscription-id="${subscription.id}">
                            <div class="btn-trial-bg">
                                <div class="btn-trial-shine"></div>
                                <div class="btn-trial-glow"></div>
                            </div>
                            <div class="btn-trial-content">
                                <div class="trial-icon-wrapper">
                                    <i class="fas fa-sync-alt"></i>
                                </div>
                                <div class="trial-text">
                                    <span class="trial-main">Продлить</span>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            `;
        });

        content += '</div>';

        return content;
    },

    /**
     * Рендеринг нижних кнопок действий
     */
    renderBottomActions() {
        return `
            <div class="subscription-bottom-actions">
                <button class="btn btn-primary btn-action-primary" data-action="buy">
                    <i class="fas fa-plus"></i>
                    Новая подписка
                </button>
                <button class="btn btn-secondary btn-action-secondary" data-action="gift">
                    <i class="fas fa-gift"></i>
                    Подарить подписку
                </button>
            </div>
        `;
    },

    /**
     * Рендеринг быстрых действий
     */
    renderQuickActions() {
        return `
            <div class="section">
                <h2 class="section-title">
                    <div id="management-animation" style="width: 32px; height: 32px; display: inline-block; margin-right: 8px;"></div>
                    Управление
                </h2>
                <div class="notcoin-actions-grid">
                    <div class="notcoin-action-card" data-action="instructions">
                        <div class="notcoin-action-content">
                            <div class="notcoin-action-text">
                                <div class="notcoin-action-title">Инструкции</div>
                                <div class="notcoin-action-subtitle">Как настроить VPN</div>
                            </div>
                            <div class="notcoin-decorative-icon">
                                <i class="fas fa-book-open"></i>
                            </div>
                        </div>
                    </div>

                    <div class="notcoin-action-card" data-action="support">
                        <div class="notcoin-action-content">
                            <div class="notcoin-action-text">
                                <div class="notcoin-action-title">Поддержка</div>
                                <div class="notcoin-action-subtitle">Помощь 24/7</div>
                            </div>
                            <div class="notcoin-decorative-icon">
                                <i class="fas fa-comment-dots"></i>
                            </div>
                        </div>
                    </div>

                    <div class="notcoin-action-card" data-action="activate-code">
                        <div class="notcoin-action-content">
                            <div class="notcoin-action-text">
                                <div class="notcoin-action-title">Активировать код</div>
                                <div class="notcoin-action-subtitle">Введите код подарка</div>
                            </div>
                            <div class="notcoin-decorative-icon">
                                <i class="fas fa-key"></i>
                            </div>
                        </div>
                    </div>

                    <div class="notcoin-action-card" data-action="news-channel">
                        <div class="notcoin-action-content">
                            <div class="notcoin-action-text">
                                <div class="notcoin-action-title">Новости</div>
                                <div class="notcoin-action-subtitle">Актуальные обновления</div>
                            </div>
                            <div class="notcoin-decorative-icon">
                                <i class="fas fa-newspaper"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг ежедневного бонуса
     */
    renderDailyBonus() {
        if (!this.dailyBonusStatus) {
            // Загружаем статус асинхронно
            this.loadDailyBonusStatus();
            return '';
        }

        const { can_claim, current_streak, next_streak, bonus_amount, next_claim_available_at } = this.dailyBonusStatus;
        const streakText = current_streak > 0 ? `День ${current_streak}/7` : 'Начните серию';
        
        return `
            <div class="section">
                <h2 class="section-title">
                    <i class="fas fa-coins" style="margin-right: 8px;"></i>
                    Ежедневный бонус
                </h2>
                <div class="daily-bonus-card ${can_claim ? 'claimable' : ''}" data-action="claim-daily-bonus">
                    <div class="daily-bonus-content">
                        <div class="daily-bonus-info">
                            <div class="daily-bonus-title">${can_claim ? 'Забрать бонус' : 'Бонус скоро доступен'}</div>
                            <div class="daily-bonus-subtitle">${streakText} • ${bonus_amount} DRG</div>
                        </div>
                        <div class="daily-bonus-action">
                            ${can_claim ? `
                                <button class="btn btn-primary btn-sm">
                                    <i class="fas fa-gift"></i>
                                    Забрать
                                </button>
                            ` : `
                                <div class="daily-bonus-timer">
                                    <i class="fas fa-clock"></i>
                                    ${next_claim_available_at ? Utils.formatTimeUntil(next_claim_available_at) : 'Скоро'}
                                </div>
                            `}
                        </div>
                    </div>
                    ${current_streak > 0 ? `
                        <div class="daily-bonus-progress">
                            ${Array.from({ length: 7 }, (_, i) => `
                                <div class="bonus-day ${i < current_streak ? 'completed' : ''} ${i === current_streak && can_claim ? 'next' : ''}"></div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    /**
     * Загрузка статуса ежедневного бонуса
     */
    async loadDailyBonusStatus() {
        try {
            if (window.CurrencyAPI) {
                this.dailyBonusStatus = await window.CurrencyAPI.getDailyBonusStatus();
                // Перерендерим если экран уже отрисован
                if (this.isLoaded) {
                    this.render();
                }
            }
        } catch (error) {
            Utils.log('error', 'Failed to load daily bonus status:', error);
            this.dailyBonusStatus = null;
        }
    },

    /**
     * Загрузка баланса валюты
     */
    async loadCurrencyBalance() {
        try {
            if (window.CurrencyAPI) {
                this.currencyBalance = await window.CurrencyAPI.getBalance();
                // Перерендерим если экран уже отрисован
                if (this.isLoaded) {
                    this.render();
                }
            }
        } catch (error) {
            Utils.log('error', 'Failed to load currency balance:', error);
            this.currencyBalance = null;
        }
    },

    /**
     * Загрузка списка ежедневных бонусов
     */
    async loadDailyBonusList() {
        try {
            if (window.CurrencyAPI) {
                this.dailyBonusList = await window.CurrencyAPI.getDailyBonusList();
            }
        } catch (error) {
            Utils.log('error', 'Failed to load daily bonus list:', error);
            this.dailyBonusList = null;
        }
    },

    /**
     * Рендеринг верхней панели с бонусом и коинами
     */
    renderTopBar() {
        const balance = this.currencyBalance?.balance || '0.00';
        const canClaim = this.dailyBonusStatus?.can_claim || false;
        const currentStreak = this.dailyBonusStatus?.current_streak || 0;

        return `
            <div class="subscription-top-bar">
                <button class="daily-bonus-button" data-action="show-daily-bonus-modal">
                    <div class="daily-bonus-button-icon">
                        <i class="fas fa-gift"></i>
                        ${canClaim ? '<span class="bonus-claim-indicator blinking"></span>' : ''}
                    </div>
                    <span class="daily-bonus-button-text">Бонус</span>
                </button>
                
                <button class="currency-balance-button" data-action="show-currency-info-modal">
                    <div class="currency-balance-icon">
                        <i class="fas fa-coins"></i>
                    </div>
                    <span class="currency-balance-amount">${parseFloat(balance).toFixed(0)}</span>
                    <span class="currency-balance-code">DRG</span>
                </button>
            </div>
        `;
    },

    /**
     * Проверка ожидающих подарков
     */
    async checkPendingGifts() {
        try {
            const telegramUser = window.TelegramApp?.getUserInfo();
            if (!telegramUser?.id) return;

            if (window.GiftAPI) {
                const pendingGifts = await window.GiftAPI.getPendingGifts(telegramUser.id);
                
                if (pendingGifts && pendingGifts.length > 0) {
                    // Показываем первый подарок
                    const gift = pendingGifts[0];
                    await this.showPendingGiftModal(gift);
                }
            }
        } catch (error) {
            Utils.log('error', 'Failed to check pending gifts:', error);
        }
    },

    /**
     * Показ модального окна ожидающего подарка
     */
    async showPendingGiftModal(gift) {
        return new Promise((resolve) => {
            if (window.Modal) {
                window.Modal.show({
                    title: 'У вас есть подарок!',
                    size: 'large',
                    content: `
                        <div class="pending-gift-content">
                            <div class="pending-gift-icon">
                                <div id="pending-gift-animation" style="width: 80px; height: 80px; margin: 0 auto;"></div>
                            </div>
                            <h3>Вам подарили подписку!</h3>
                            ${gift.sender_display_name ? `
                                <p class="gift-sender">От: <strong>${Utils.escapeHtml(gift.sender_display_name)}</strong></p>
                            ` : ''}
                            ${gift.message ? `
                                <div class="gift-message">
                                    <p><strong>Сообщение:</strong></p>
                                    <p>${Utils.escapeHtml(gift.message)}</p>
                                </div>
                            ` : ''}
                            <div class="gift-details">
                                <p>Подарок активируется автоматически после подтверждения</p>
                            </div>
                        </div>
                    `,
                    buttons: [
                        {
                            id: 'activate',
                            text: 'Активировать подарок',
                            type: 'primary',
                            handler: async () => {
                                try {
                                    if (window.Loading) {
                                        window.Loading.show('Активация подарка...');
                                    }

                                    await window.GiftAPI.activateGift(gift.gift_id);

                                    if (window.Loading) {
                                        window.Loading.hide();
                                    }

                                    await this.showGiftActivationSuccess(gift);
                                    await this.refresh();

                                    if (window.TelegramApp) {
                                        window.TelegramApp.haptic.success();
                                    }

                                    resolve(true);
                                } catch (error) {
                                    if (window.Loading) {
                                        window.Loading.hide();
                                    }

                                    Utils.log('error', 'Failed to activate gift:', error);
                                    if (window.Toast) {
                                        window.Toast.error(error.data?.comment || error.message || 'Ошибка активации подарка');
                                    }
                                    resolve(false);
                                }
                            }
                        },
                        {
                            id: 'later',
                            text: 'Позже',
                            action: 'close'
                        }
                    ],
                    onShow: () => {
                        setTimeout(() => {
                            if (window.TGSLoader) {
                                window.TGSLoader.loadTGSAnimation(
                                    'pending-gift-animation',
                                    'assets/images/gifs/gift-animate.tgs',
                                    'fas fa-gift'
                                );
                            }
                        }, 100);
                    },
                    onCancel: () => {
                        // Показываем анимацию подарка на главном экране
                        this.showGiftAnimation();
                        resolve(false);
                    }
                });
            }
        });
    },

    /**
     * Показ анимации подарка на главном экране
     */
    showGiftAnimation() {
        // Добавляем индикатор подарка на экран
        const container = document.getElementById('subscriptionScreen');
        if (container) {
            const giftIndicator = document.createElement('div');
            giftIndicator.className = 'pending-gift-indicator';
            giftIndicator.innerHTML = `
                <div class="gift-indicator-content" data-action="activate-code">
                    <div id="gift-indicator-animation" style="width: 48px; height: 48px;"></div>
                    <span>У вас есть подарок!</span>
                </div>
            `;
            container.appendChild(giftIndicator);

            setTimeout(() => {
                if (window.TGSLoader) {
                    window.TGSLoader.loadTGSAnimation(
                        'gift-indicator-animation',
                        'assets/images/gifs/gift-animate.tgs',
                        'fas fa-gift'
                    );
                }
            }, 100);
        }
    },

    /**
     * Получение имени сервиса
     */
    getServiceName(subscription) {
        if (this.isTrialSubscription(subscription)) {
            return 'Пробный период';
        }

        const service = this.servicesCache.get(subscription.service_id);
        if (service) {
            return service.name;
        }

        return `Подписка ${subscription.service_id.slice(0, 8)}`;
    },

    /**
     * Проверка на пробный период
     */
    isTrialSubscription(subscription) {
        // Главный критерий: проверяем, является ли текущий service_id пробным сервисом
        // Если подписка была продлена на обычный сервис, она больше не пробная,
        // даже если source остался 'trial'
        const service = this.servicesCache.get(subscription.service_id);
        if (service && service.is_trial) {
            return true;
        }
        
        // Если service_id не найден в кеше, проверяем source как fallback
        // Но только если service_id не определен (старые данные)
        if (!service && subscription.source === 'trial') {
            return true;
        }
        
        return false;
    },

        /**
     * Определение типа подписки для отображения
     */
    getSubscriptionType(subscription) {
        if (this.isTrialSubscription(subscription)) {
            return 'trial';
        }

        const daysLeft = Utils.daysBetween(subscription.end_date);
        if (daysLeft <= 0) {
            return 'expired';
        }

        return 'active';
    },

    /**
     * Обновление UI автопродления
     */
    updateAutoRenewalUI(subscriptionId, autoRenewal) {
        Utils.log('info', 'updateAutoRenewalUI called:', { subscriptionId, autoRenewal });
        
        // Преобразуем subscriptionId в строку для селектора
        const idStr = String(subscriptionId);
        
        // Обновляем полный формат
        const autoRenewalElement = document.querySelector(`[data-subscription-id="${idStr}"].auto-renewal`);
        const toggle = autoRenewalElement ? autoRenewalElement.querySelector('.toggle-switch') : null;
        const statusText = autoRenewalElement ? autoRenewalElement.querySelector('.auto-renewal-status') : null;

        Utils.log('info', 'Found elements:', { 
            autoRenewalElement: !!autoRenewalElement,
            toggle: !!toggle,
            statusText: !!statusText
        });

        if (toggle) {
            if (autoRenewal) {
                toggle.classList.add('active');
            } else {
                toggle.classList.remove('active');
            }
            Utils.log('info', 'Toggle updated:', { hasActive: toggle.classList.contains('active') });
        }

        if (statusText) {
            const subscription = this.currentSubscriptions.find(s => {
                const subId = s.subscription_id || s.id;
                return subId === subscriptionId || String(subId) === idStr;
            });
            
            if (subscription) {
                const renewalDate = Utils.formatDate(subscription.end_date);
                statusText.textContent = autoRenewal
                    ? `Продление ${renewalDate}`
                    : `Завершится ${renewalDate}`;
                Utils.log('info', 'Status text updated');
            }
        }

        // Обновляем компактный формат
        const compactAutoRenewal = document.querySelector(`[data-subscription-id="${idStr}"].subscription-compact-auto-renewal`);
        const compactToggle = compactAutoRenewal ? compactAutoRenewal.querySelector('.toggle-switch-compact') : null;
        
        if (compactToggle) {
            if (autoRenewal) {
                compactToggle.classList.add('active');
            } else {
                compactToggle.classList.remove('active');
            }
            Utils.log('info', 'Compact toggle updated');
        }
    },

    /**
     * Анимация активации пробного периода
     */
    async showTrialActivationAnimation() {
        return new Promise((resolve) => {
            const animationElement = Utils.createElement('div', {
                className: 'trial-activation'
            }, `
                <div class="trial-activation-content">
                    <div class="trial-activation-icon">
                        <i class="fas fa-gift"></i>
                    </div>
                    <h2 class="trial-activation-title">Пробный период активирован!</h2>
                    <p class="trial-activation-subtitle">Вы получили 5 дней бесплатного доступа</p>
                    <ul class="trial-activation-features">
                        <li>Безлимитный трафик</li>
                        <li>Все серверы доступны</li>
                        <li>Максимальная скорость</li>
                    </ul>
                </div>
            `);

            document.body.appendChild(animationElement);

            // Показываем анимацию
            setTimeout(() => {
                animationElement.classList.add('active');
            }, 100);

            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

            setTimeout(() => {
                animationElement.classList.remove('active');
                setTimeout(() => {
                    animationElement.remove();
                    resolve();
                }, 500);
            }, 4000);
        });
    },

    /**
     * Анимация появления элементов
     */
    animateElements() {
        const elements = document.querySelectorAll('#subscriptionScreen .card, #subscriptionScreen .action-card');
        elements.forEach((el, index) => {
            el.classList.add('stagger-item');
            el.style.animationDelay = `${index * 0.1}s`;
        });
    },

    /**
     * Обновление данных подписки
     */
    async refresh() {
        this.servicesCache.clear();
        await this.loadServices();
        await this.loadSubscriptions();
        this.render();
    },

    /**
     * Проверка истечения подписок
     */
    checkExpiredSubscriptions() {
        let hasExpiredSubscriptions = false;

        this.currentSubscriptions.forEach(subscription => {
            const daysLeft = Utils.daysBetween(subscription.end_date);
            if (daysLeft <= 0 && subscription.status === 'active') {
                subscription.status = 'expired';
                hasExpiredSubscriptions = true;
            }
        });

        if (hasExpiredSubscriptions) {
            this.render();

            if (window.Toast) {
                window.Toast.warning('Некоторые подписки истекли');
            }
        }
    },

    /**
     * Получение активных подписок
     */
    getActiveSubscriptions() {
        return this.currentSubscriptions.filter(s => {
            const daysLeft = Utils.daysBetween(s.end_date);
            return daysLeft > 0 && (s.status === 'active' || s.status === 'trial');
        });
    },

    /**
     * Показ модального окна ежедневных бонусов
     */
    async showDailyBonusModal() {
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }

        // Загружаем данные если еще не загружены
        if (!this.dailyBonusStatus) {
            await this.loadDailyBonusStatus();
        }
        if (!this.dailyBonusList) {
            await this.loadDailyBonusList();
        }

        const status = this.dailyBonusStatus || {};
        const bonuses = this.dailyBonusList?.bonuses || [];
        const currentStreak = status.current_streak || 0;
        const nextStreak = status.next_streak || 0;
        const canClaim = status.can_claim || false;
        const nextClaimAt = status.next_claim_available_at;

        if (window.Modal) {
            window.Modal.show({
                title: 'Ежедневные бонусы',
                size: 'large',
                content: `
                    <div class="daily-bonus-modal-content">
                        <div class="daily-bonus-header-compact">
                            <div class="streak-info-compact">
                                <i class="fas fa-fire"></i>
                                <span>Серия: ${currentStreak}</span>
                            </div>
                            ${nextClaimAt && !canClaim ? `
                                <div class="next-claim-compact">
                                    <i class="fas fa-clock"></i>
                                    <span>Через ${this.formatTimeUntil(nextClaimAt)}</span>
                                </div>
                            ` : ''}
                        </div>

                        <div class="daily-bonus-horizontal-scroll">
                            <div class="scroll-fade-left"></div>
                            <div class="daily-bonus-cards-container" id="dailyBonusScrollContainer">
                                ${bonuses.map((bonus, index) => {
                                    // Четкая логика для определения статусов карточек
                                    const nextStreak = status.next_streak || 0;
                                    
                                    // Следующий день для получения - день с номером next_streak (желтый)
                                    const isNext = canClaim && bonus.day_number === nextStreak;
                                    
                                    // Забранные дни: ТОЛЬКО дни с номером меньше next_streak
                                    // Это означает дни, которые уже забраны в текущем цикле
                                    const isClaimed = bonus.day_number < nextStreak;
                                    
                                    // ВАЖНО: Заблокированные дни - это все дни, которые:
                                    // - НЕ забраны (day_number >= next_streak)
                                    // - НЕ являются следующим днем (day_number !== next_streak)
                                    // Они будут черными (без классов claimed и next)
                                    
                                    return `
                                        <div class="daily-bonus-card-horizontal ${isClaimed ? 'claimed' : ''} ${isNext ? 'next' : ''}" data-day="${bonus.day_number}" data-index="${index}">
                                            <div class="bonus-card-header">
                                                <div class="bonus-day-badge">День ${bonus.day_number}</div>
                                                ${bonus.is_final ? '<div class="bonus-final-tag">Финальный</div>' : ''}
                                            </div>
                                            <div class="bonus-card-amount">
                                                <i class="fas fa-coins"></i>
                                                <span class="amount-value">${bonus.amount}</span>
                                                <span class="amount-code">DRG</span>
                                            </div>
                                            <div class="bonus-card-status">
                                                ${isClaimed ? '<div class="status-claimed"><i class="fas fa-check-circle"></i> Забран</div>' : ''}
                                                ${isNext ? '<div class="status-available"><i class="fas fa-gift"></i> Доступен</div>' : ''}
                                                ${!isClaimed && !isNext ? '<div class="status-locked"><i class="fas fa-lock"></i> Заблокирован</div>' : ''}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            <div class="scroll-fade-right"></div>
                        </div>
                    </div>
                `,
                buttons: [
                    {
                        id: 'close',
                        text: 'Закрыть',
                        action: 'close',
                        position: 'left'
                    },
                    {
                        id: 'claim',
                        text: 'Забрать бонус',
                        icon: 'fas fa-gift',
                        type: 'primary',
                        position: 'right',
                        action: 'custom',
                        disabled: !canClaim,
                        closeAfter: false, // ЯВНО запрещаем закрытие модального окна
                        handler: async () => {
                            if (!canClaim) return 'keep-open'; // Возвращаем keep-open для гарантии
                            await this.handleClaimDailyBonus();
                            return 'keep-open'; // ЯВНО возвращаем keep-open чтобы модальное окно НЕ закрывалось
                        }
                    }
                ],
                onShow: () => {
                    // Мгновенный скролл к нужному дню ДО показа модального окна (без анимации)
                    // Выполняем сразу после добавления в DOM, но до анимации появления
                    const container = document.getElementById('dailyBonusScrollContainer');
                    if (container) {
                        // Выполняем скролл синхронно, без задержек
                        const status = this.dailyBonusStatus || {};
                        const currentStreak = status.current_streak || 0;
                        const nextStreak = status.next_streak || 0;
                        const canClaim = status.can_claim || false;
                        
                        let targetDayNumber;
                        if (canClaim && nextStreak > 0) {
                            targetDayNumber = nextStreak;
                        } else if (currentStreak > 0) {
                            targetDayNumber = currentStreak;
                        } else {
                            targetDayNumber = 1;
                        }
                        
                        const targetCard = container.querySelector(`[data-day="${targetDayNumber}"]`) || 
                                         container.querySelector(`[data-index="${targetDayNumber - 1}"]`);
                        
                        if (targetCard) {
                            const cardLeft = targetCard.offsetLeft;
                            const cardWidth = targetCard.offsetWidth;
                            const containerWidth = container.clientWidth;
                            const scrollPosition = cardLeft - (containerWidth / 2) + (cardWidth / 2);
                            
                            // Мгновенный скролл без анимации
                            container.scrollLeft = Math.max(0, scrollPosition);
                        }
                    }
                    
                    // Настройка умного скролла
                    this.setupSmartScroll();
                    
                    // Обновление эффектов затухания
                    requestAnimationFrame(() => {
                        this.updateScrollFade();
                    });
                },
                onHide: () => {
                    // Cleanup при закрытии
                    const container = document.getElementById('dailyBonusScrollContainer');
                    if (container && container._bonusScrollCleanup) {
                        container._bonusScrollCleanup();
                        delete container._bonusScrollCleanup;
                    }
                }
            });
        }
    },

    /**
     * Показ модального окна информации о валюте
     */
    async showCurrencyInfoModal() {
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }

        // Загружаем баланс если еще не загружен
        if (!this.currencyBalance) {
            await this.loadCurrencyBalance();
        }

        const balance = this.currencyBalance || {};
        const balanceAmount = balance.balance || '0.00';
        const totalEarned = balance.total_earned || '0.00';
        const totalSpent = balance.total_spent || '0.00';
        const currencyName = balance.currency_name || 'Dragon Coins';
        const currencyCode = balance.currency_code || 'DRG';

        if (window.Modal) {
            window.Modal.show({
                title: 'Dragon Coins',
                size: 'small',
                content: `
                    <div class="currency-info-modal-content">
                        <div class="currency-info-header">
                            <div class="currency-icon-large">
                                <i class="fas fa-coins"></i>
                            </div>
                            <div class="currency-name">${currencyName}</div>
                            <div class="currency-code">${currencyCode}</div>
                        </div>

                        <div class="currency-stats">
                            <div class="currency-stat-item">
                                <div class="stat-icon earned">
                                    <i class="fas fa-arrow-up"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-label">Всего заработано</div>
                                    <div class="stat-value">${parseFloat(totalEarned).toFixed(0)} ${currencyCode}</div>
                                </div>
                            </div>
                            <div class="currency-stat-item">
                                <div class="stat-icon spent">
                                    <i class="fas fa-arrow-down"></i>
                                </div>
                                <div class="stat-content">
                                    <div class="stat-label">Всего потрачено</div>
                                    <div class="stat-value">${parseFloat(totalSpent).toFixed(0)} ${currencyCode}</div>
                                </div>
                            </div>
                        </div>

                        <div class="currency-info-description">
                            <div class="info-section">
                                <p>
                                    <i class="fas fa-info-circle"></i> 
                                    Зарабатывайте ${currencyCode} за ежедневные бонусы и приглашение друзей. 
                                    В будущем можно будет использовать для покупки подписок.
                                </p>
                            </div>
                        </div>
                    </div>
                `,
                buttons: [
                    {
                        id: 'close',
                        text: 'Закрыть',
                        action: 'close'
                    }
                ]
            });
        }
    },

    /**
     * Обработка получения бонуса
     */
    async handleClaimDailyBonus() {
        try {
            if (window.Loading) {
                window.Loading.show('Получение бонуса...');
            }

            const response = await window.CurrencyAPI.claimDailyBonus();
            const bonusAmount = response.bonus_amount || '0';
            
            if (window.Loading) {
                window.Loading.hide();
            }

            // Показываем анимацию начисления бонуса в модальном окне
            this.showBonusClaimAnimation(bonusAmount);

            // Обновляем данные
            await this.loadDailyBonusStatus();
            await this.loadCurrencyBalance();
            this.render();

            // Обновляем модальное окно с новыми данными
            this.updateDailyBonusModal();

            if (window.TelegramApp) {
                window.TelegramApp.haptic.success();
            }

        } catch (error) {
            if (window.Loading) {
                window.Loading.hide();
            }

            Utils.log('error', 'Failed to claim daily bonus:', error);
            if (window.Toast) {
                window.Toast.error(error.data?.comment || error.message || 'Ошибка получения бонуса');
            }
        }
    },

    /**
     * Показ анимации начисления бонуса
     */
    showBonusClaimAnimation(bonusAmount) {
        const container = document.getElementById('dailyBonusScrollContainer');
        if (!container) return;

        // Находим текущую карточку бонуса
        const status = this.dailyBonusStatus || {};
        const nextStreak = status.next_streak || 0;
        const targetCard = container.querySelector(`[data-day="${nextStreak}"]`);
        
        if (!targetCard) return;

        // Создаем элемент анимации
        const animationElement = document.createElement('div');
        animationElement.className = 'bonus-claim-animation';
        animationElement.innerHTML = `
            <div class="bonus-animation-content">
                <div class="bonus-animation-icon">
                    <i class="fas fa-coins"></i>
                </div>
                <div class="bonus-animation-text">
                    <div class="bonus-animation-amount">+${bonusAmount}</div>
                    <div class="bonus-animation-label">DRG</div>
                </div>
            </div>
        `;

        // Позиционируем относительно карточки
        const cardRect = targetCard.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        document.body.appendChild(animationElement);
        
        // Устанавливаем начальную позицию
        animationElement.style.position = 'fixed';
        animationElement.style.left = `${cardRect.left + cardRect.width / 2}px`;
        animationElement.style.top = `${cardRect.top + cardRect.height / 2}px`;
        animationElement.style.transform = 'translate(-50%, -50%) scale(0)';
        animationElement.style.zIndex = '10000';

        // Анимация появления - плавная, 2 секунды общая длительность
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                animationElement.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
                animationElement.style.transform = 'translate(-50%, -50%) scale(1)';
                animationElement.style.opacity = '1';
            });
        });

        // Держим анимацию видимой
        setTimeout(() => {
            // Легкое покачивание
            animationElement.style.transition = 'all 0.2s ease-out';
            animationElement.style.transform = 'translate(-50%, -50%) scale(1.03)';
        }, 800);

        // Плавное движение вверх и исчезновение - общая длительность 2 секунды
        setTimeout(() => {
            animationElement.style.transition = 'all 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            animationElement.style.transform = `translate(-50%, ${cardRect.top - 120}px) scale(0.8)`;
            animationElement.style.opacity = '0';
        }, 1000);

        // Удаляем элемент после завершения анимации (2 секунды)
        setTimeout(() => {
            if (animationElement.parentNode) {
                animationElement.parentNode.removeChild(animationElement);
            }
        }, 2200);
    },

    /**
     * Обновление модального окна с новыми данными
     */
    updateDailyBonusModal() {
        const status = this.dailyBonusStatus || {};
        const bonuses = this.dailyBonusList?.bonuses || [];
        const currentStreak = status.current_streak || 0;
        const nextStreak = status.next_streak || 0;
        const canClaim = status.can_claim || false;
        const nextClaimAt = status.next_claim_available_at;

        const container = document.getElementById('dailyBonusScrollContainer');
        if (!container) return;

        // Обновляем карточки
        bonuses.forEach((bonus, index) => {
            const card = container.querySelector(`[data-day="${bonus.day_number}"]`);
            if (!card) return;

            const nextStreak = status.next_streak || 0;
            
            // Следующий день для получения - день с номером next_streak (желтый)
            const isNext = canClaim && bonus.day_number === nextStreak;
            
            // Забранные дни: ТОЛЬКО дни с номером меньше next_streak
            // Это означает дни, которые уже забраны в текущем цикле
            const isClaimed = bonus.day_number < nextStreak;
            
            // ВАЖНО: Заблокированные дни - это все дни, которые:
            // - НЕ забраны (day_number >= next_streak)
            // - НЕ являются следующим днем (day_number !== next_streak)
            // Они будут черными (без классов claimed и next)

            // Обновляем классы - четко: либо claimed (зеленый), либо next (желтый), либо ничего (черный)
            card.className = `daily-bonus-card-horizontal ${isClaimed ? 'claimed' : ''} ${isNext ? 'next' : ''}`;

            // Обновляем статус
            const statusElement = card.querySelector('.bonus-card-status');
            if (statusElement) {
                if (isClaimed) {
                    statusElement.innerHTML = '<div class="status-claimed"><i class="fas fa-check-circle"></i> Забран</div>';
                } else if (isNext) {
                    statusElement.innerHTML = '<div class="status-available"><i class="fas fa-gift"></i> Доступен</div>';
                } else {
                    statusElement.innerHTML = '<div class="status-locked"><i class="fas fa-lock"></i> Заблокирован</div>';
                }
            }
            
            // Обновляем data-атрибуты для корректной работы скролла
            card.setAttribute('data-day', bonus.day_number);
            card.setAttribute('data-index', index);
        });

        // Обновляем кнопку "Забрать бонус"
        const claimButton = document.querySelector('button[data-button-id="claim"]');
        if (claimButton) {
            claimButton.disabled = !canClaim;
            if (!canClaim) {
                claimButton.classList.add('btn-disabled');
            } else {
                claimButton.classList.remove('btn-disabled');
            }
        }

        // Обновляем заголовок с серией
        const streakInfo = document.querySelector('.streak-info-compact span');
        if (streakInfo) {
            streakInfo.textContent = `Серия: ${currentStreak}`;
        }
    },

    /**
     * Форматирование времени до следующего бонуса
     */
    formatTimeUntil(dateString) {
        if (!dateString) return '';
        
        const now = new Date();
        const target = new Date(dateString);
        const diff = target - now;

        if (diff <= 0) return 'сейчас';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours} ${Utils.pluralize(hours, ['час', 'часа', 'часов'])} ${minutes} ${Utils.pluralize(minutes, ['минута', 'минуты', 'минут'])}`;
        }
        return `${minutes} ${Utils.pluralize(minutes, ['минута', 'минуты', 'минут'])}`;
    },

    /**
     * Автоскролл к нужному дню при открытии модального окна
     * @param {boolean} instant - Если true, скролл мгновенный (без анимации)
     */
    scrollToCurrentDay(instant = false) {
        // Небольшая задержка для рендера DOM
        setTimeout(() => {
            const container = document.getElementById('dailyBonusScrollContainer');
            if (!container) return;

            const status = this.dailyBonusStatus || {};
            const currentStreak = status.current_streak || 0;
            const nextStreak = status.next_streak || 0;
            const canClaim = status.can_claim || false;
            
            // Определяем целевой день:
            // - Если can_claim = true, показываем next_streak (день, который можно забрать)
            // - Если can_claim = false, показываем current_streak (текущий день, на котором пользователь)
            let targetDayNumber;
            if (canClaim && nextStreak > 0) {
                targetDayNumber = nextStreak; // День, который можно забрать
            } else if (currentStreak > 0) {
                targetDayNumber = currentStreak; // Текущий день пользователя
            } else {
                targetDayNumber = 1; // Первый день, если нет прогресса
            }

            // Находим карточку по номеру дня (data-day)
            const targetCard = container.querySelector(`[data-day="${targetDayNumber}"]`);
            if (!targetCard) {
                // Если не нашли по data-day, пробуем найти по индексу (fallback)
                const targetIndex = targetDayNumber - 1; // Конвертируем в 0-based индекс
                const fallbackCard = container.querySelector(`[data-index="${targetIndex}"]`);
                if (!fallbackCard) return;
                
                // Используем fallback карточку
                const cardLeft = fallbackCard.offsetLeft;
                const cardWidth = fallbackCard.offsetWidth;
                const containerWidth = container.clientWidth;
                const scrollPosition = cardLeft - (containerWidth / 2) + (cardWidth / 2);
                
                // Мгновенный или плавный скролл
                if (instant) {
                    container.scrollLeft = Math.max(0, scrollPosition);
                    this.updateScrollFade();
                } else {
                    container.scrollTo({
                        left: Math.max(0, scrollPosition),
                        behavior: 'smooth'
                    });
                    setTimeout(() => {
                        this.updateScrollFade();
                    }, 300);
                }
                return;
            }

            // Вычисляем позицию для центрирования карточки
            const cardLeft = targetCard.offsetLeft;
            const cardWidth = targetCard.offsetWidth;
            const containerWidth = container.clientWidth;
            
            // Центрируем карточку
            const scrollPosition = cardLeft - (containerWidth / 2) + (cardWidth / 2);
            
            // Мгновенный или плавный скролл
            if (instant) {
                container.scrollLeft = Math.max(0, scrollPosition);
                this.updateScrollFade();
            } else {
                container.scrollTo({
                    left: Math.max(0, scrollPosition),
                    behavior: 'smooth'
                });
                setTimeout(() => {
                    this.updateScrollFade();
                }, 300);
            }
        }, instant ? 50 : 150); // Меньшая задержка для мгновенного скролла
    },

    /**
     * Настройка умного скролла с плавным перелистыванием карточек
     */
    setupSmartScroll() {
        const container = document.getElementById('dailyBonusScrollContainer');
        if (!container) return;

        // Флаг для предотвращения закрытия модального окна во время скролла
        let isScrollingActive = false;
        let scrollStartTime = 0;

        let scrollTimeout = null;
        let isUserScrolling = false;
        let lastScrollLeft = container.scrollLeft;
        let isScrolling = false;

        const handleScroll = () => {
            isUserScrolling = true;
            isScrolling = true;
            isScrollingActive = true; // Активный скролл
            
            // Предотвращаем закрытие модального окна во время скролла
            if (window.Modal && window.Modal.backdrop) {
                window.Modal.backdrop.dataset.scrolling = 'true';
            }
            
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }

            // Обновляем затемнение во время скролла
            this.updateScrollFade();

            scrollTimeout = setTimeout(() => {
                isUserScrolling = false;
                isScrolling = false;
                this.updateScrollFade();
                
                // Сбрасываем флаг скролла с задержкой
                setTimeout(() => {
                    isScrollingActive = false;
                    if (window.Modal && window.Modal.backdrop) {
                        delete window.Modal.backdrop.dataset.scrolling;
                    }
                }, 150);
            }, 100);
        };

        // ✅ ОПТИМИЗАЦИЯ: Используем throttle для scroll события
        const throttledHandleScroll = Utils.throttle(handleScroll, 100);
        container.addEventListener('scroll', throttledHandleScroll, { passive: true });

        // Drag-to-scroll функциональность
        let isDragging = false;
        let startX = 0;
        let scrollLeftStart = 0;

        const handleMouseDown = (e) => {
            isDragging = true;
            isScrollingActive = true; // Начали скролл
            scrollStartTime = Date.now();
            container.style.cursor = 'grabbing';
            container.style.userSelect = 'none';
            startX = e.pageX - container.offsetLeft;
            scrollLeftStart = container.scrollLeft;
            
            // Предотвращаем закрытие модального окна
            if (window.Modal && window.Modal.backdrop) {
                window.Modal.backdrop.dataset.scrolling = 'true';
            }
            
            if (window.TelegramApp) {
                window.TelegramApp.haptic.impactOccurred('light');
            }
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 1.2; // Более плавная скорость прокрутки
            container.scrollLeft = scrollLeftStart - walk;
            
            // Обновляем затемнение во время drag
            this.updateScrollFade();
        };

        const handleMouseUp = () => {
            isDragging = false;
            container.style.cursor = 'grab';
            container.style.userSelect = '';
            
            // Сбрасываем флаг скролла с задержкой, чтобы предотвратить случайное закрытие
            setTimeout(() => {
                isScrollingActive = false;
                if (window.Modal && window.Modal.backdrop) {
                    delete window.Modal.backdrop.dataset.scrolling;
                }
            }, 200);
        };

        const handleMouseLeave = () => {
            if (isDragging) {
                handleMouseUp();
            }
        };

        // Touch события для мобильных устройств
        let touchStartX = 0;
        let touchScrollLeftStart = 0;

        const handleTouchStart = (e) => {
            isScrollingActive = true; // Начали скролл
            scrollStartTime = Date.now();
            touchStartX = e.touches[0].pageX - container.offsetLeft;
            touchScrollLeftStart = container.scrollLeft;
            
            // Предотвращаем закрытие модального окна
            if (window.Modal && window.Modal.backdrop) {
                window.Modal.backdrop.dataset.scrolling = 'true';
            }
        };

        const handleTouchMove = (e) => {
            if (!touchStartX) return;
            const x = e.touches[0].pageX - container.offsetLeft;
            const walk = (x - touchStartX) * 1.2; // Более плавная скорость прокрутки
            container.scrollLeft = touchScrollLeftStart - walk;
            
            // Обновляем затемнение во время touch
            this.updateScrollFade();
        };

        const handleTouchEnd = () => {
            touchStartX = 0;
            
            // Сбрасываем флаг скролла с задержкой, чтобы предотвратить случайное закрытие
            setTimeout(() => {
                isScrollingActive = false;
                if (window.Modal && window.Modal.backdrop) {
                    delete window.Modal.backdrop.dataset.scrolling;
                }
            }, 200);
        };

        // ✅ ОПТИМИЗАЦИЯ: Используем throttle для mousemove
        const throttledHandleMouseMove = Utils.throttle(handleMouseMove, 16); // ~60fps
        
        // Добавляем обработчики для мыши
        container.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', throttledHandleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        container.addEventListener('mouseleave', handleMouseLeave);

        // Добавляем обработчики для touch
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        // Устанавливаем курсор grab
        container.style.cursor = 'grab';

        // Инициализация затухания
        this.updateScrollFade();

        // Cleanup функция
        const cleanup = () => {
            container.removeEventListener('scroll', handleScroll);
            container.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            container.removeEventListener('mouseleave', handleMouseLeave);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.style.cursor = '';
            container.style.userSelect = '';
        };

        // Сохраняем cleanup в контейнере для доступа при закрытии
        container._bonusScrollCleanup = cleanup;
    },

    /**
     * Выравнивание скролла на ближайшую карточку для плавного перелистывания
     */
    snapToNearestCard(container) {
        if (!container) return;

        const scrollLeft = container.scrollLeft;
        const clientWidth = container.clientWidth;
        const containerCenter = scrollLeft + (clientWidth / 2);

        // Находим все карточки
        const cards = Array.from(container.querySelectorAll('.daily-bonus-card-horizontal'));
        if (cards.length === 0) return;

        let nearestCard = null;
        let minDistance = Infinity;

        // Находим ближайшую карточку к центру контейнера
        cards.forEach((card) => {
            const cardLeft = card.offsetLeft;
            const cardWidth = card.offsetWidth;
            const cardCenter = cardLeft + (cardWidth / 2);
            const distance = Math.abs(cardCenter - containerCenter);

            if (distance < minDistance) {
                minDistance = distance;
                nearestCard = card;
            }
        });

        if (nearestCard) {
            const cardLeft = nearestCard.offsetLeft;
            const cardWidth = nearestCard.offsetWidth;
            const cardCenter = cardLeft + (cardWidth / 2);
            const targetScroll = cardCenter - (clientWidth / 2);

            // Плавно выравниваем на ближайшую карточку
            container.scrollTo({
                left: Math.max(0, Math.min(targetScroll, container.scrollWidth - clientWidth)),
                behavior: 'smooth'
            });

            // Обновляем затемнение после выравнивания
            setTimeout(() => {
                this.updateScrollFade();
            }, 300);
        }
    },

    /**
     * Ограничение позиции скролла
     */
    limitScrollPosition(container) {
        if (!container) return;

        const scrollLeft = container.scrollLeft;
        const clientWidth = container.clientWidth;

        // Первый день - ограничение влево
        const firstCard = container.querySelector('[data-index="0"]');
        if (firstCard) {
            const firstCardLeft = firstCard.offsetLeft;
            const firstCardWidth = firstCard.offsetWidth;
            const firstCardCenter = firstCardLeft + (firstCardWidth / 2);
            const containerCenter = clientWidth / 2;
            const minScroll = firstCardCenter - containerCenter;

            if (scrollLeft < minScroll) {
                container.scrollTo({
                    left: Math.max(0, minScroll),
                    behavior: 'smooth'
                });
                return;
            }
        }

        // Последний день - ограничение вправо
        const lastCard = container.querySelector('[data-index="6"]');
        if (lastCard) {
            const lastCardLeft = lastCard.offsetLeft;
            const lastCardWidth = lastCard.offsetWidth;
            const lastCardCenter = lastCardLeft + (lastCardWidth / 2);
            const containerCenter = clientWidth / 2;
            const maxScroll = lastCardCenter - containerCenter;
            const scrollWidth = container.scrollWidth;

            if (scrollLeft > maxScroll) {
                container.scrollTo({
                    left: Math.min(scrollWidth - clientWidth, maxScroll),
                    behavior: 'smooth'
                });
            }
        }
    },

    /**
     * Обновление эффектов затухания при скролле
     */
    updateScrollFade() {
        const container = document.getElementById('dailyBonusScrollContainer');
        if (!container) return;

        const scrollLeft = container.scrollLeft;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        const maxScroll = Math.max(0, scrollWidth - clientWidth);

        const scrollWrapper = container.parentElement;
        if (!scrollWrapper) return;

        const fadeLeft = scrollWrapper.querySelector('.scroll-fade-left');
        const fadeRight = scrollWrapper.querySelector('.scroll-fade-right');

        // Левое затухание - показываем если есть контент слева
        if (fadeLeft) {
            const threshold = 10;
            const fadeDistance = 100;
            if (scrollLeft > threshold) {
                // Есть контент слева - показываем затемнение
                const leftOpacity = Math.min(1, Math.max(0.6, (scrollLeft / fadeDistance)));
                fadeLeft.style.opacity = leftOpacity;
            } else {
                // Нет контента слева - скрываем затемнение
                fadeLeft.style.opacity = 0;
            }
        }

        // Правое затухание - показываем если есть контент справа
        if (fadeRight) {
            const threshold = 10;
            const fadeDistance = 100;
            const distanceFromEnd = maxScroll - scrollLeft;
            if (distanceFromEnd > threshold) {
                // Есть контент справа - показываем затемнение
                const rightOpacity = Math.min(1, Math.max(0.6, (distanceFromEnd / fadeDistance)));
                fadeRight.style.opacity = rightOpacity;
            } else {
                // Нет контента справа - скрываем затемнение
                fadeRight.style.opacity = 0;
            }
        }
    },

    /**
     * Очистка данных
     */
    cleanup() {
        this.currentSubscriptions = [];
        this.isLoaded = false;
        this.isEmpty = false;
        this.currencyBalance = null;
        this.dailyBonusList = null;

        const container = document.getElementById('subscriptionScreen');
        if (container) {
            container.innerHTML = '';
        }
    }
};