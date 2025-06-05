// Payment Banner Component for Dragon VPN Mini App

window.PaymentBanner = {
    banner: null,
    currentPayment: null,
    timer: null,
    isVisible: false,

    /**
     * Инициализация баннера
     */
    init() {
        this.createBanner();
        this.setupEventListeners();
        Utils.log('info', 'Payment banner initialized');
    },

    /**
     * Создание баннера
     */
    createBanner() {
        this.banner = document.getElementById('paymentBanner');
        if (!this.banner) {
            this.banner = Utils.createElement('div', {
                id: 'paymentBanner',
                className: 'payment-banner hidden'
            });
            document.body.appendChild(this.banner);
        }
    },

    /**
     * Показать баннер оплаты
     * @param {Object} payment - Данные платежа
     */
    show(payment) {
        if (!payment || !payment.id) {
            Utils.log('error', 'Invalid payment data for banner');
            return;
        }

        this.currentPayment = payment;
        this.render();
        this.banner.classList.remove('hidden');
        this.isVisible = true;

        // Добавляем отступ для основного контента
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.classList.add('with-payment-banner');
        }

        // Запускаем таймер
        this.startTimer();

        Utils.log('info', 'Payment banner shown:', payment.id);
    },

    /**
     * Скрыть баннер
     */
    hide() {
        if (!this.isVisible) return;

        this.stopTimer();
        this.banner.classList.add('hidden');
        this.isVisible = false;
        this.currentPayment = null;

        // Убираем отступ
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.classList.remove('with-payment-banner');
        }

        Utils.log('info', 'Payment banner hidden');
    },

    /**
     * Рендеринг баннера
     */
    render() {
        if (!this.currentPayment) return;

        const timeLeft = this.calculateTimeLeft();
        const { minutes, seconds } = this.parseTime(timeLeft);

        this.banner.innerHTML = `
            <div class="payment-banner-content">
                <div class="payment-info">
                    <div class="payment-timer">
                        <div class="timer-circle">
                            <svg class="timer-progress ${timeLeft > 0 ? 'active' : ''}" width="32" height="32">
                                <circle cx="16" cy="16" r="14" stroke-width="2"></circle>
                            </svg>
                            <span class="timer-text" id="paymentTimer">${this.formatTime(minutes, seconds)}</span>
                        </div>
                        <div class="payment-text">
                            <div class="payment-title">Время оплаты</div>
                            <div class="payment-subtitle">Ожидание платежа</div>
                        </div>
                    </div>
                </div>
                <button class="btn btn-sm btn-primary" id="continuePaymentBtn">
                    Продолжить оплату
                </button>
            </div>
        `;

        this.updateProgress(timeLeft);
        this.setupBannerEvents();
    },

    /**
     * Настройка событий баннера
     */
    setupBannerEvents() {
        const continueBtn = document.getElementById('continuePaymentBtn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.handleContinuePayment();
            });
        }
    },

    /**
     * Настройка общих событий
     */
    setupEventListeners() {
        // Слушаем успешные платежи
        document.addEventListener('paymentSuccess', (e) => {
            const paymentId = e.detail?.paymentId;
            if (paymentId && this.currentPayment?.id === paymentId) {
                this.hide();
            }
        });

        // Слушаем отмену платежей
        document.addEventListener('paymentCancelled', (e) => {
            const paymentId = e.detail?.paymentId;
            if (paymentId && this.currentPayment?.id === paymentId) {
                this.hide();
            }
        });
    },

    /**
     * Запуск таймера
     */
    startTimer() {
        this.stopTimer(); // Останавливаем предыдущий таймер

        this.timer = setInterval(() => {
            const timeLeft = this.calculateTimeLeft();

            if (timeLeft <= 0) {
                this.handleTimeout();
                return;
            }

            const { minutes, seconds } = this.parseTime(timeLeft);
            const timerElement = document.getElementById('paymentTimer');
            if (timerElement) {
                timerElement.textContent = this.formatTime(minutes, seconds);
            }

            this.updateProgress(timeLeft);
        }, 1000);
    },

    /**
     * Остановка таймера
     */
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    },

    /**
     * Вычисление оставшегося времени
     */
    calculateTimeLeft() {
        if (!this.currentPayment?.expires_at) return 0;

        const expiresAt = new Date(this.currentPayment.expires_at);
        const now = new Date();
        const diff = expiresAt - now;

        return Math.max(0, Math.floor(diff / 1000)); // в секундах
    },

    /**
     * Парсинг времени
     */
    parseTime(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return { minutes, seconds };
    },

    /**
     * Форматирование времени
     */
    formatTime(minutes, seconds) {
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    /**
     * Обновление прогресса круга
     */
    updateProgress(timeLeft) {
        const circle = this.banner.querySelector('.timer-progress circle');
        if (!circle || !this.currentPayment?.expires_at) return;

        // Предполагаем что платеж действует 1 час (3600 секунд)
        const totalTime = 3600;
        const progress = Math.max(0, Math.min(1, timeLeft / totalTime));
        const circumference = 2 * Math.PI * 14; // radius = 14
        const offset = circumference * (1 - progress);

        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = offset;
    },

    /**
     * Обработка таймаута
     */
    handleTimeout() {
        this.stopTimer();

        // Уведомляем об истечении времени
        if (window.Toast) {
            window.Toast.error('Время оплаты истекло');
        }

        // Удаляем из pending платежей
        if (window.Storage && this.currentPayment?.id) {
            window.Storage.removePendingPayment(this.currentPayment.id);
        }

        this.hide();
    },

    /**
     * Продолжить оплату
     */
    handleContinuePayment() {
        if (!this.currentPayment?.payment_url) {
            if (window.Toast) {
                window.Toast.error('Ссылка на оплату недоступна');
            }
            return;
        }

        // Вибрация
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }

        // Открываем ссылку на оплату
        window.TelegramApp.openLink(this.currentPayment.payment_url);

        Utils.log('info', 'Continue payment clicked:', this.currentPayment.id);
    },

    /**
     * Повтор оплаты
     */
    async retry() {
        if (!this.currentPayment) return;

        try {
            // Создаем новый платеж с теми же параметрами
            const newPayment = await window.PaymentAPI.createPayment({
                service_id: this.currentPayment.service_id,
                service_type: this.currentPayment.service_type || 'new',
                description: this.currentPayment.description || 'Повторная оплата',
                price: this.currentPayment.price || this.currentPayment.amount
            });

            // Обновляем баннер
            this.show(newPayment);

            if (window.Toast) {
                window.Toast.success('Новый платеж создан');
            }

        } catch (error) {
            Utils.log('error', 'Failed to retry payment:', error);
            if (window.Toast) {
                window.Toast.error('Ошибка создания платежа');
            }
        } finally {
        }
    },

    /**
     * Проверка видимости
     */
    isShowing() {
        return this.isVisible;
    },

    /**
     * Получение текущего платежа
     */
    getCurrentPayment() {
        return this.currentPayment;
    }
};