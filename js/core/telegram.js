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

                if (this.webApp.initDataUnsafe.start_param) {
                    const referrerId = this.webApp.initDataUnsafe.start_param;
                    this.referrerId = referrerId;
                }
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

        } catch (error) {
            Utils.log('error', 'Failed to initialize Telegram WebApp', error);
            this.initFallback();
        }
    },

    getReferrerId() {
        return this.referrerId || null;
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
            this.webApp.ready();

            // 2. Расширяем до максимума
            this.webApp.expand();

            // 3. Настраиваем цвета ОДИНАКОВЫЕ с фоном (скрываем заголовок)
            this.webApp.setHeaderColor('#0d0d0d');
            this.webApp.setBackgroundColor('#0d0d0d');

            // 4. Убираем название бота из заголовка
            if (this.webApp.setBottomBarColor) {
                this.webApp.setBottomBarColor('#0d0d0d');
            }

            // 5. 🔥 БЛОКИРУЕМ закрытие приложения
            this.webApp.enableClosingConfirmation();

            // 6. Отключаем вертикальные свайпы которые могут закрыть приложение
            if (this.webApp.disableVerticalSwipes) {
                this.webApp.disableVerticalSwipes();
            }

            // 7. Скрываем стандартные кнопки Telegram
            this.webApp.MainButton.hide();
            this.webApp.BackButton.hide();

            // 8. 🔥 БЛОКИРУЕМ возможность закрытия через скролл
            this.preventSwipeToClose();

        } catch (error) {
            Utils.log('error', 'Failed to setup interface', error);
        }
    },

    preventSwipeToClose() {
        if (!this.webApp) return;

        // Отслеживаем изменения viewport
        this.webApp.onEvent('viewportChanged', (eventData) => {
            // Если приложение стало меньше - принудительно расширяем
            if (eventData && !eventData.isExpanded) {
                setTimeout(() => {
                    this.webApp.expand();
                }, 50);
            }
        });

        // 🔥 Блокируем закрытие через DOM события
        let startY = 0;
        let isScrolling = false;

        document.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isScrolling = false;
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;

            // Если пользователь скроллит вниз И находится в начале страницы
            const mainContent = document.querySelector('.main-content');
            const isAtTop = mainContent ? mainContent.scrollTop <= 5 : window.scrollY <= 5;

            if (deltaY > 0 && isAtTop && deltaY > 50) {
                // Блокируем событие которое может закрыть приложение
                e.preventDefault();
                e.stopPropagation();
                isScrolling = true;

                // Принудительно расширяем приложение
                this.webApp.expand();
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (isScrolling) {
                e.preventDefault();
                e.stopPropagation();
                // Финальная проверка что приложение расширено
                this.webApp.expand();
            }
        }, { passive: false });
    },

    forceExpand() {
        if (!this.webApp) return;

        try {
            this.webApp.expand();
            // Дублируем через короткий таймаут для надежности
            setTimeout(() => {
                this.webApp.expand();
            }, 100);

            setTimeout(() => {
                this.webApp.expand();
            }, 500);

        } catch (error) {
            Utils.log('error', 'Failed to force expand', error);
        }
    },

    /**
     * Настройка событий
     */
    setupEvents() {
        if (!this.webApp) return;

        // Обработка изменения viewport
        this.webApp.onEvent('viewportChanged', (eventData) => {
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