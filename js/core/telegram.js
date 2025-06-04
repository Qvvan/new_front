// Telegram WebApp Integration for Dragon VPN Mini App

window.TelegramApp = {
    isInitialized: false,
    webApp: null,
    initData: null,
    user: null,

    /**
     * Инициализация Telegram WebApp
     */
    init() {
        if (typeof window.Telegram === 'undefined' || !window.Telegram.WebApp) {
            Utils.log('error', 'Telegram WebApp not available');
            // Fallback для разработки
            this.initFallback();
            return;
        }

        this.webApp = window.Telegram.WebApp;
        this.initData = this.webApp.initData;

        try {
            // Парсим данные пользователя
            if (this.webApp.initDataUnsafe && this.webApp.initDataUnsafe.user) {
                this.user = this.webApp.initDataUnsafe.user;
                Utils.log('info', 'Telegram user data loaded', this.user);
            }

            // Настраиваем тему
            this.setupTheme();

            // Настраиваем интерфейс
            this.setupInterface();

            // Настраиваем события
            this.setupEvents();

            // Готовим приложение
            this.webApp.ready();
            this.webApp.expand();

            this.isInitialized = true;
            Utils.log('info', 'Telegram WebApp initialized successfully');

        } catch (error) {
            Utils.log('error', 'Failed to initialize Telegram WebApp', error);
            this.initFallback();
        }
    },

    /**
     * Fallback инициализация для разработки
     */
    initFallback() {
        Utils.log('warn', 'Using fallback mode for development');
        this.user = {
            id: 123456789,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            language_code: 'ru'
        };
        this.isInitialized = true;
    },

    /**
     * Настройка темы приложения
     */
    setupTheme() {
        if (!this.webApp) return;

        try {
            // Устанавливаем цвета согласно нашей теме
            this.webApp.setHeaderColor('#0d0d0d');
            this.webApp.setBackgroundColor('#0d0d0d');

            if (this.webApp.setBottomBarColor) {
                this.webApp.setBottomBarColor('#111111');
            }

            // Отслеживаем изменения темы
            this.webApp.onEvent('themeChanged', () => {
                Utils.log('info', 'Theme changed');
                this.applyThemeColors();
            });

        } catch (error) {
            Utils.log('error', 'Failed to setup theme', error);
        }
    },

    /**
     * Применение цветов темы
     */
    applyThemeColors() {
        if (!this.webApp || !this.webApp.themeParams) return;

        const theme = this.webApp.themeParams;
        const root = document.documentElement;

        // Обновляем CSS переменные если нужно
        if (theme.bg_color) {
            root.style.setProperty('--tg-bg-color', theme.bg_color);
        }
        if (theme.text_color) {
            root.style.setProperty('--tg-text-color', theme.text_color);
        }
    },

    /**
     * Настройка интерфейса
     */
    setupInterface() {
        if (!this.webApp) return;

        try {
            // Отключаем подтверждение закрытия по умолчанию
            this.webApp.disableClosingConfirmation();

            // Включаем вертикальные свайпы
            if (this.webApp.enableVerticalSwipes) {
                this.webApp.enableVerticalSwipes();
            }

            // Скрываем главную кнопку по умолчанию
            this.webApp.MainButton.hide();

            // Скрываем кнопку назад по умолчанию
            this.webApp.BackButton.hide();

        } catch (error) {
            Utils.log('error', 'Failed to setup interface', error);
        }
    },

    /**
     * Настройка событий
     */
    setupEvents() {
        if (!this.webApp) return;

        // Обработка изменения viewport
        this.webApp.onEvent('viewportChanged', (eventData) => {
            Utils.log('debug', 'Viewport changed', eventData);
            this.handleViewportChange(eventData);
        });

        // Обработка кнопки назад
        this.webApp.BackButton.onClick(() => {
            this.handleBackButton();
        });

        // Обработка главной кнопки
        this.webApp.MainButton.onClick(() => {
            this.handleMainButton();
        });

        // Обработка закрытия приложения
        this.webApp.onEvent('mainButtonClicked', () => {
            Utils.log('debug', 'Main button clicked');
        });
    },

    /**
     * Обработка изменения viewport
     */
    handleViewportChange(eventData) {
        const isStable = eventData && eventData.isStateStable;
        if (isStable) {
            // Обновляем CSS переменные для высоты viewport
            document.documentElement.style.setProperty(
                '--tg-viewport-height',
                `${this.webApp.viewportHeight}px`
            );
        }
    },

    /**
     * Обработка кнопки назад
     */
    handleBackButton() {
        if (window.Router && typeof window.Router.goBack === 'function') {
            window.Router.goBack();
        } else {
            // Fallback - закрываем приложение
            this.close();
        }
    },

    /**
     * Обработка главной кнопки
     */
    handleMainButton() {
        // Эмитируем событие для роутера или активного экрана
        const event = new CustomEvent('mainButtonClick');
        document.dispatchEvent(event);
    },

    /**
     * Вибрация (haptic feedback)
     */
    haptic: {
        /**
         * Легкая вибрация при тапе
         */
        light() {
            try {
                if (TelegramApp.webApp && TelegramApp.webApp.HapticFeedback) {
                    TelegramApp.webApp.HapticFeedback.impactOccurred('light');
                } else if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            } catch (error) {
                Utils.log('debug', 'Haptic feedback not available');
            }
        },

        /**
         * Средняя вибрация
         */
        medium() {
            try {
                if (TelegramApp.webApp && TelegramApp.webApp.HapticFeedback) {
                    TelegramApp.webApp.HapticFeedback.impactOccurred('medium');
                } else if (navigator.vibrate) {
                    navigator.vibrate(100);
                }
            } catch (error) {
                Utils.log('debug', 'Haptic feedback not available');
            }
        },

        /**
         * Сильная вибрация
         */
        heavy() {
            try {
                if (TelegramApp.webApp && TelegramApp.webApp.HapticFeedback) {
                    TelegramApp.webApp.HapticFeedback.impactOccurred('heavy');
                } else if (navigator.vibrate) {
                    navigator.vibrate(200);
                }
            } catch (error) {
                Utils.log('debug', 'Haptic feedback not available');
            }
        },

        /**
         * Уведомление об успехе
         */
        success() {
            try {
                if (TelegramApp.webApp && TelegramApp.webApp.HapticFeedback) {
                    TelegramApp.webApp.HapticFeedback.notificationOccurred('success');
                } else if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }
            } catch (error) {
                Utils.log('debug', 'Haptic feedback not available');
            }
        },

        /**
         * Уведомление об ошибке
         */
        error() {
            try {
                if (TelegramApp.webApp && TelegramApp.webApp.HapticFeedback) {
                    TelegramApp.webApp.HapticFeedback.notificationOccurred('error');
                } else if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
            } catch (error) {
                Utils.log('debug', 'Haptic feedback not available');
            }
        },

        /**
         * Уведомление о предупреждении
         */
        warning() {
            try {
                if (TelegramApp.webApp && TelegramApp.webApp.HapticFeedback) {
                    TelegramApp.webApp.HapticFeedback.notificationOccurred('warning');
                } else if (navigator.vibrate) {
                    navigator.vibrate([150, 75, 150]);
                }
            } catch (error) {
                Utils.log('debug', 'Haptic feedback not available');
            }
        },

        /**
         * Вибрация при изменении селекции
         */
        selection() {
            try {
                if (TelegramApp.webApp && TelegramApp.webApp.HapticFeedback) {
                    TelegramApp.webApp.HapticFeedback.selectionChanged();
                } else if (navigator.vibrate) {
                    navigator.vibrate(30);
                }
            } catch (error) {
                Utils.log('debug', 'Haptic feedback not available');
            }
        }
    },

    /**
     * Показать главную кнопку
     */
    showMainButton(text, onClick) {
        if (!this.webApp) return;

        try {
            this.webApp.MainButton.setText(text);
            this.webApp.MainButton.show();

            if (onClick) {
                this.webApp.MainButton.onClick(onClick);
            }
        } catch (error) {
            Utils.log('error', 'Failed to show main button', error);
        }
    },

    /**
     * Скрыть главную кнопку
     */
    hideMainButton() {
        if (!this.webApp) return;

        try {
            this.webApp.MainButton.hide();
        } catch (error) {
            Utils.log('error', 'Failed to hide main button', error);
        }
    },

    /**
     * Показать кнопку назад
     */
    showBackButton() {
        if (!this.webApp) return;

        try {
            this.webApp.BackButton.show();
        } catch (error) {
            Utils.log('error', 'Failed to show back button', error);
        }
    },

    /**
     * Скрыть кнопку назад
     */
    hideBackButton() {
        if (!this.webApp) return;

        try {
            this.webApp.BackButton.hide();
        } catch (error) {
            Utils.log('error', 'Failed to hide back button', error);
        }
    },

    /**
     * Открыть ссылку
     */
    openLink(url, options = {}) {
        if (!this.webApp) {
            window.open(url, '_blank');
            return;
        }

        try {
            this.webApp.openLink(url, options);
        } catch (error) {
            Utils.log('error', 'Failed to open link', error);
            window.open(url, '_blank');
        }
    },

    /**
     * Открыть Telegram ссылку
     */
    openTelegramLink(url) {
        if (!this.webApp) {
            window.open(url, '_blank');
            return;
        }

        try {
            this.webApp.openTelegramLink(url);
        } catch (error) {
            Utils.log('error', 'Failed to open Telegram link', error);
            window.open(url, '_blank');
        }
    },

    /**
     * Показать popup
     */
    showPopup(params) {
        return new Promise((resolve) => {
            if (!this.webApp || !this.webApp.showPopup) {
                // Fallback для браузера
                const result = confirm(params.message);
                resolve(result ? 'ok' : 'cancel');
                return;
            }

            try {
                this.webApp.showPopup(params, (buttonId) => {
                    resolve(buttonId);
                });
            } catch (error) {
                Utils.log('error', 'Failed to show popup', error);
                resolve(null);
            }
        });
    },

    /**
     * Показать alert
     */
    showAlert(message) {
        return new Promise((resolve) => {
            if (!this.webApp || !this.webApp.showAlert) {
                alert(message);
                resolve();
                return;
            }

            try {
                this.webApp.showAlert(message, resolve);
            } catch (error) {
                Utils.log('error', 'Failed to show alert', error);
                alert(message);
                resolve();
            }
        });
    },

    /**
     * Показать confirm
     */
    showConfirm(message) {
        return new Promise((resolve) => {
            if (!this.webApp || !this.webApp.showConfirm) {
                resolve(confirm(message));
                return;
            }

            try {
                this.webApp.showConfirm(message, resolve);
            } catch (error) {
                Utils.log('error', 'Failed to show confirm', error);
                resolve(confirm(message));
            }
        });
    },

    /**
     * Поделиться ссылкой
     */
    async share(url, text = '') {
        // Проверяем Web Share API
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Dragon VPN',
                    text: text,
                    url: url
                });
                return true;
            } catch (error) {
                Utils.log('debug', 'Web Share API failed', error);
            }
        }

        // Fallback - копируем в буфер обмена
        const shareText = text ? `${text}\n${url}` : url;
        const copied = await Utils.copyToClipboard(shareText);

        if (copied) {
            if (window.Toast) {
                window.Toast.show('Ссылка скопирована в буфер обмена', 'success');
            }
            return true;
        }

        return false;
    },

    /**
     * Получить данные для аутентификации
     */
    getAuthData() {
        if (!this.isInitialized) {
            Utils.log('warn', 'Telegram WebApp not initialized');
            return null;
        }

        return {
            initData: this.initData || '',
            user: this.user,
            platform: Utils.getPlatform(),
            version: this.webApp ? this.webApp.version : '6.0'
        };
    },

    /**
     * Закрыть приложение
     */
    close() {
        if (this.webApp) {
            this.webApp.close();
        } else {
            // Fallback для браузера
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.close();
            }
        }
    },

    /**
     * Получить информацию о пользователе
     */
    getUserInfo() {
        return this.user;
    },

    /**
     * Проверить, запущено ли в Telegram
     */
    isInTelegram() {
        return this.webApp !== null;
    },

    /**
     * Получить initData для API запросов
     */
    getInitData() {
        return this.initData || '';
    }
};