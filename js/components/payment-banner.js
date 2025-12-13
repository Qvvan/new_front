// Payment Banner Component for Dragon VPN Mini App
window.PaymentBanner = {
    currentPayment: null,
    timerInterval: null,
    isVisible: false,
    element: null,

    init() {
        this.element = document.getElementById('paymentBanner');
        if (!this.element) {
            Utils.log('error', 'Payment banner element not found');
            return;
        }
    },

    /**
     * Показать баннер с платежом
     */
    async show(payment) {
        if (!this.element || !payment) return;

        if (payment.status === 'succeeded') {
            return;
        }

        if (payment.status !== 'pending') {
            return;
        }

        if (!payment.payment_url && !payment.url && !payment.receipt_link) {
            Utils.log('warn', 'Payment URL missing, trying to get from storage');

            // Пытаемся получить URL из pending платежей в Storage
            const pendingPayments = await window.Storage?.getPendingPayments() || [];
            const storedPayment = pendingPayments.find(p =>
                p.id === payment.id || p.payment_id === payment.payment_id
            );

            if (storedPayment && (storedPayment.payment_url || storedPayment.receipt_link)) {
                payment.payment_url = storedPayment.payment_url || storedPayment.receipt_link;
                payment.url = storedPayment.url || storedPayment.receipt_link;
            }
        }

        // ✅ Если это pending платеж, но нет URL - не показываем баннер
        if (!payment.payment_url && !payment.url && !payment.receipt_link) {
            Utils.log('error', `Pending payment ${payment.id} has no payment URL, cannot show banner`);

            // Удаляем этот платеж из мониторинга, так как он некорректный
            if (window.PaymentMonitor) {
                window.PaymentMonitor.removePayment(payment.id);
            }

            if (window.Storage) {
                await window.Storage.removePendingPayment(payment.id);
            }

            return;
        }

        // ✅ Нормализуем URLs - используем receipt_link как основной источник
        if (!payment.payment_url && payment.receipt_link) {
            payment.payment_url = payment.receipt_link;
        }
        if (!payment.url && payment.receipt_link) {
            payment.url = payment.receipt_link;
        }

        // Обогащаем платеж данными сервиса
        await this.enrichPaymentWithServiceData(payment);

        this.currentPayment = payment;
        this.isVisible = true;

        // Добавляем offset для контента
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.classList.add('with-payment-banner');
        }

        this.render();
        this.startTimer();
        this.updateBadge();

        // Показываем баннер
        this.element.classList.remove('hidden');
    },

    async enrichPaymentWithServiceData(payment) {
        if (!payment.service_id) return;

        try {
            // Пытаемся получить данные сервиса
            const response = await window.ServiceAPI.getService(payment.service_id);
            const service = response.service || response; // API может возвращать разную структуру

            if (service) {
                payment.service_name = service.name;
                payment.service_duration = this.formatDuration(service.duration_days);
                payment.service_original_price = service.price; // Оригинальная цена сервиса

                // Если в платеже нет цены, используем цену сервиса
                if (!payment.price || payment.price === 0) {
                    payment.price = service.price;
                }
            }
        } catch (error) {
            Utils.log('warn', 'Could not load service data for payment banner:', error);
            // Используем fallback данные
            payment.service_name = payment.description?.split(' - ')[0] || 'VPN подписка';
            payment.service_duration = 'Подписка';

            // Если нет цены в платеже, пытаемся извлечь из описания или ставим 0
            if (!payment.price || payment.price === 0) {
                payment.price = this.extractPriceFromDescription(payment.description) || 0;
            }
        }
    },

    extractPriceFromDescription(description) {
        if (!description) return 0;

        // Ищем числа в описании (например "Валдрим - 285 руб")
        const priceMatch = description.match(/(\d+)/);
        return priceMatch ? parseInt(priceMatch[1]) : 0;
    },

    formatDuration(days) {
        if (!days) return 'Подписка';

        if (days >= 365) {
            return `${Math.round(days / 365)} год`;
        } else if (days >= 30) {
            return `${Math.round(days / 30)} мес`;
        } else {
            return `${days} дн`;
        }
    },

    /**
     * Скрыть баннер
     */
    hide() {
        if (!this.element) return;

        this.isVisible = false;
        this.currentPayment = null;

        // Убираем offset
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.classList.remove('with-payment-banner');
        }

        this.stopTimer();
        this.clearBadge();

        // Скрываем баннер
        this.element.classList.add('hidden');
    },

    /**
     * Рендеринг баннера
     */
    render() {
        if (!this.element || !this.currentPayment) return;

        const timeLeft = this.getTimeLeft();
        const formattedTime = this.formatTime(timeLeft);
        const progressPercent = this.getProgressPercent();

        const serviceName = this.currentPayment.service_name || 'VPN подписка';
        const serviceDuration = this.currentPayment.service_duration || '';
        const paymentPrice = this.currentPayment.price || 0;

        // ✅ Определяем текст кнопки по статусу
        const isSucceeded = this.currentPayment.status === 'succeeded';
        const buttonText = isSucceeded ? 'Чек' : 'Продолжить';
        const buttonIcon = isSucceeded ? 'fa-receipt' : 'fa-credit-card';

        this.element.innerHTML = `
            <div class="payment-banner-content">
                <div class="payment-info">
                    <div class="payment-timer">
                        <div class="timer-circle">
                            <svg class="timer-progress" width="32" height="32">
                                <circle cx="16" cy="16" r="14"
                                       stroke-width="2"
                                       stroke-dashoffset="${88 - (88 * progressPercent / 100)}"
                                       class="${timeLeft > 0 ? 'active' : ''}"></circle>
                            </svg>
                            <span class="timer-text">${isSucceeded ? '✓' : formattedTime}</span>
                        </div>
                        <div class="payment-text">
                            <div class="payment-title">${serviceName}</div>
                            <div class="payment-subtitle">
                                ${Utils.formatPrice(paymentPrice)}
                                ${serviceDuration ? ` • ${serviceDuration}` : ''}
                                ${isSucceeded ? ' • Оплачено' : ''}
                            </div>
                        </div>
                    </div>
                </div>
                <button class="btn btn-sm btn-primary" id="continuePaymentBtn">
                    <i class="fas ${buttonIcon}"></i>
                    ${buttonText}
                </button>
            </div>
        `;

        this.setupEventListeners();
    },

    /**
     * Настройка событий
     */
    setupEventListeners() {
        const continueBtn = document.getElementById('continuePaymentBtn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.handleContinuePayment();
            });
        }
    },

    /**
     * Обработка продолжения оплаты
     */
    handleContinuePayment() {
        if (!this.currentPayment) return;

        // Вибрация
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }

        // ✅ ИСПРАВЛЕНИЕ: Проверяем статус платежа
        if (this.currentPayment.status === 'succeeded') {
            // Платеж уже успешен - показываем чек
            const receiptUrl = this.currentPayment.receipt_link;
            if (receiptUrl) {
                if (window.TelegramApp) {
                    window.TelegramApp.openLink(receiptUrl);
                } else {
                    window.open(receiptUrl, '_blank');
                }
                return;
            } else {
                if (window.Toast) {
                    window.Toast.success('Платеж уже обработан');
                }
                this.hide(); // Скрываем баннер
                return;
            }
        }

        // ✅ Для pending платежей ищем правильные поля
        const paymentUrl = this.currentPayment.payment_url ||
                          this.currentPayment.url ||
                          this.currentPayment.receipt_link; // ← Добавить receipt_link как fallback

        if (paymentUrl) {

            if (window.TelegramApp) {
                window.TelegramApp.openLink(paymentUrl);
            } else {
                window.open(paymentUrl, '_blank');
            }
        } else {
            Utils.log('error', 'No payment URL found in payment:', this.currentPayment);

            if (window.Toast) {
                window.Toast.warning('Ссылка на оплату недоступна');
            }

            // Переходим к списку платежей
            if (window.Router) {
                window.Router.navigate('payments');
            }
        }
    },

    /**
     * Запуск таймера
     */
    startTimer() {
        this.stopTimer(); // Останавливаем предыдущий

        this.timerInterval = setInterval(() => {
            const timeLeft = this.getTimeLeft();

            if (timeLeft <= 0) {
                this.handlePaymentExpired();
                return;
            }

            this.updateTimer();
        }, 1000);
    },

    /**
     * Остановка таймера
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    /**
     * Обновление таймера
     */
    updateTimer() {
        const timeLeft = this.getTimeLeft();
        const formattedTime = this.formatTime(timeLeft);
        const progressPercent = this.getProgressPercent();

        const timerText = document.querySelector('.timer-text');
        const progressCircle = document.querySelector('.timer-progress circle');

        if (timerText) {
            timerText.textContent = formattedTime;
        }

        if (progressCircle) {
            const offset = 88 - (88 * progressPercent / 100);
            progressCircle.style.strokeDashoffset = offset;
        }
    },

    /**
     * Получение оставшегося времени в секундах
     */
    getTimeLeft() {
        if (!this.currentPayment || !this.currentPayment.created_at) return 0;

        const createdTime = new Date(this.currentPayment.created_at).getTime();
        const currentTime = Date.now();
        const paymentDuration = 60 * 60 * 1000; // 1 час
        const elapsed = currentTime - createdTime;
        const remaining = Math.max(0, paymentDuration - elapsed);

        return Math.floor(remaining / 1000);
    },

    /**
     * Получение прогресса в процентах
     */
    getProgressPercent() {
        if (!this.currentPayment) return 0;

        const totalDuration = 60 * 60; // 1 час в секундах
        const timeLeft = this.getTimeLeft();
        return Math.max(0, (timeLeft / totalDuration) * 100);
    },

    /**
     * Форматирование времени
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * Обработка истечения времени платежа
     */
    handlePaymentExpired() {
        this.stopTimer();

        if (window.Toast) {
            window.Toast.warning('Время оплаты истекло');
        }

        // Убираем из pending списка
        if (window.PaymentMonitor) {
            window.PaymentMonitor.removePayment(this.currentPayment.id);
        }

        this.hide();
    },

    /**
     * Обновление бейджа в навигации
     */
    updateBadge() {
        if (window.Navigation) {
            window.Navigation.setBadge('payments', 1);
            window.Navigation.setNotificationIndicator('payments', true);
        }
    },

    /**
     * Очистка бейджа
     */
    clearBadge() {
        if (window.Navigation) {
            window.Navigation.clearBadge('payments');
            window.Navigation.setNotificationIndicator('payments', false);
        }
    },

    /**
     * Получение текущего платежа
     */
    getCurrentPayment() {
        return this.currentPayment;
    },

    /**
     * Проверка видимости
     */
    isShowing() {
        return this.isVisible;
    }
};