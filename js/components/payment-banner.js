// Payment Banner Component for Dragon VPN Mini App
window.PaymentBanner = {
    currentPayment: null,
    timerInterval: null,
    animationFrameId: null, // Для совместимости (если где-то используется)
    isVisible: false,
    element: null,
    servicesCache: new Map(), // Кеш сервисов

    init() {
        this.element = document.getElementById('paymentBanner');
        if (!this.element) {
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
            // Удаляем этот платеж из мониторинга, так как он некорректный
            if (window.PaymentMonitor) {
                window.PaymentMonitor.removePayment(payment.id);
            }

            if (window.Storage) {
                await window.Storage.removePendingPayment(payment.id);
            }

            return;
        }

        // ✅ Нормализуем URLs - для pending используем confirmation_url, для succeeded - receipt_link
        if (payment.status === 'pending') {
            if (!payment.payment_url && payment.confirmation_url) {
                payment.payment_url = payment.confirmation_url;
            }
            if (!payment.url && payment.confirmation_url) {
                payment.url = payment.confirmation_url;
            }
        } else {
            if (!payment.payment_url && payment.receipt_link) {
                payment.payment_url = payment.receipt_link;
            }
            if (!payment.url && payment.receipt_link) {
                payment.url = payment.receipt_link;
            }
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

    /**
     * Загрузка и кеширование сервисов
     */
    async loadServices() {
        try {
            const response = await window.ServiceAPI.getServices();
            const servicesList = response.services || [];

            // Кешируем сервисы по ID
            this.servicesCache.clear();
            servicesList.forEach(service => {
                this.servicesCache.set(service.service_id || service.id, service);
            });
        } catch (error) {
            // Игнорируем ошибки загрузки сервисов
        }
    },

    async enrichPaymentWithServiceData(payment) {
        // Если данные уже есть в платеже - используем их
        if (payment.service_name && payment.service_duration) {
            return;
        }

        // Загружаем сервисы если кеш пуст
        if (this.servicesCache.size === 0) {
            await this.loadServices();
        }

        // Пытаемся найти сервис в кеше
        if (payment.service_id) {
            const service = this.servicesCache.get(payment.service_id);
            
            if (service) {
                payment.service_name = service.name;
                payment.service_duration = this.formatDuration(service.duration_days);
                payment.service_original_price = service.price;

                // Если в платеже нет цены, используем цену сервиса
                if (!payment.price || payment.price === 0) {
                    payment.price = service.price;
                }
                return;
            }
        }

        // Fallback: используем данные из описания платежа
        payment.service_name = payment.description?.split(' - ')[0] || 
                               payment.service_name || 
                               'VPN подписка';
        
        // Пытаемся определить длительность из описания
        if (!payment.service_duration) {
            const desc = payment.description || '';
            // Ищем паттерны типа "1 месяц", "30 дней" и т.д.
            if (desc.includes('месяц') || desc.includes('мес')) {
                const months = desc.match(/(\d+)\s*(месяц|мес)/i);
                if (months) {
                    payment.service_duration = `${months[1]} ${Utils.pluralize(parseInt(months[1]), ['месяц', 'месяца', 'месяцев'])}`;
                } else {
                    payment.service_duration = '1 месяц';
                }
            } else if (desc.includes('день') || desc.includes('дн')) {
                const days = desc.match(/(\d+)\s*(день|дн|дней)/i);
                if (days) {
                    payment.service_duration = `${days[1]} ${Utils.pluralize(parseInt(days[1]), ['день', 'дня', 'дней'])}`;
                } else {
                    payment.service_duration = '30 дней';
                }
            } else if (desc.includes('год')) {
                const years = desc.match(/(\d+)\s*год/i);
                if (years) {
                    payment.service_duration = `${years[1]} ${Utils.pluralize(parseInt(years[1]), ['год', 'года', 'лет'])}`;
                } else {
                    payment.service_duration = '1 год';
                }
            } else {
                payment.service_duration = 'Подписка';
            }
        }

        // Если нет цены в платеже, пытаемся извлечь из описания или используем amount
        if (!payment.price || payment.price === 0) {
            payment.price = payment.amount || 
                           this.extractPriceFromDescription(payment.description) || 
                           0;
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
                            <svg class="timer-progress" width="44" height="44">
                                <circle cx="22" cy="22" r="20"
                                       stroke-width="3"
                                       stroke-dasharray="125.6"
                                       stroke-dashoffset="${125.6 - (125.6 * progressPercent / 100)}"
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
            continueBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Предотвращаем всплытие
                this.handleContinuePayment();
            });
        }

        // Клик по баннеру открывает модальное окно с деталями
        if (this.element) {
            this.element.addEventListener('click', (e) => {
                // Не открываем модалку если клик по кнопке
                if (e.target.closest('#continuePaymentBtn')) {
                    return;
                }
                this.showPaymentDetails();
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

        // ✅ Для pending платежей используем confirmation_url, для succeeded - receipt_link
        const paymentUrl = this.currentPayment.status === 'pending' 
            ? (this.currentPayment.confirmation_url || this.currentPayment.payment_url || this.currentPayment.url)
            : (this.currentPayment.receipt_link || this.currentPayment.payment_url || this.currentPayment.url);

        if (paymentUrl) {

            if (window.TelegramApp) {
                window.TelegramApp.openLink(paymentUrl);
            } else {
                window.open(paymentUrl, '_blank');
            }
        } else {
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
        this.stopTimer();

        if (!this.visibilityHandler) {
            this.visibilityHandler = () => {
                if (document.hidden) {
                    this.stopTimer();
                } else if (this.isVisible && this.currentPayment) {
                    this.startTimer();
                }
            };
            document.addEventListener('visibilitychange', this.visibilityHandler);
        }

        if (document.hidden || !this.isVisible || !this.currentPayment) {
            return;
        }

        this.timerInterval = setInterval(() => {
            if (document.hidden || !this.isVisible || !this.currentPayment) {
                this.stopTimer();
                return;
            }

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
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    },

    cleanup() {
        this.stopTimer();
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
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
            const offset = 125.6 - (125.6 * progressPercent / 100);
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
    },

    /**
     * Показать модальное окно с деталями платежа
     */
    showPaymentDetails() {
        if (!this.currentPayment) return;

        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }

        const payment = this.currentPayment;
        const isPending = payment.status === 'pending';
        const isSuccess = payment.status === 'succeeded';
        const statusText = isPending ? 'Ожидает оплаты' :
                          isSuccess ? 'Успешно оплачено' : 'Отменено';
        const statusClass = isPending ? 'pending' : isSuccess ? 'success' : 'canceled';

        // Форматируем дату создания и обновления
        const createdAt = payment.created_at ? Utils.formatDate(payment.created_at, 'long') : 'Неизвестно';
        const updatedAt = payment.updated_at ? Utils.formatDate(payment.updated_at, 'long') : createdAt;

        if (window.Modal) {
            window.Modal.show({
                title: 'Детали платежа',
                content: `
                    <div class="payment-details">
                        <div class="payment-detail-item">
                            <span class="detail-label">ID платежа</span>
                            <span class="detail-value payment-id">${payment.payment_id || payment.id || 'Неизвестно'}</span>
                        </div>
                        <div class="payment-detail-item">
                            <span class="detail-label">Услуга</span>
                            <span class="detail-value">${payment.service_name || 'VPN подписка'}</span>
                        </div>
                        ${payment.service_duration ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">Период</span>
                                <span class="detail-value">${payment.service_duration}</span>
                            </div>
                        ` : ''}
                        <div class="payment-detail-item">
                            <span class="detail-label">Сумма</span>
                            <span class="detail-value final-price">${Utils.formatPrice(payment.price || payment.amount || 0)}</span>
                        </div>
                        <div class="payment-detail-item">
                            <span class="detail-label">Статус</span>
                            <span class="detail-value payment-status ${statusClass}">
                                ${statusText}
                            </span>
                        </div>
                        <div class="payment-detail-item">
                            <span class="detail-label">Дата создания</span>
                            <span class="detail-value">${createdAt}</span>
                        </div>
                        ${updatedAt !== createdAt ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">Последнее обновление</span>
                                <span class="detail-value">${updatedAt}</span>
                            </div>
                        ` : ''}
                        ${payment.description ? `
                            <div class="payment-detail-item">
                                <span class="detail-label">Описание</span>
                                <span class="detail-value">${payment.description}</span>
                            </div>
                        ` : ''}
                    </div>
                `,
                buttons: [
                    ...(isPending ? [{
                        id: 'continue',
                        text: 'Продолжить оплату',
                        type: 'primary',
                        handler: () => {
                            this.handleContinuePayment();
                            if (window.Modal) {
                                window.Modal.hide();
                            }
                        }
                    }] : []),
                    ...(isSuccess && payment.receipt_link ? [{
                        id: 'receipt',
                        text: 'Открыть чек',
                        type: 'primary',
                        handler: () => {
                            if (window.TelegramApp) {
                                window.TelegramApp.openLink(payment.receipt_link);
                            } else {
                                window.open(payment.receipt_link, '_blank');
                            }
                            if (window.Modal) {
                                window.Modal.hide();
                            }
                        }
                    }] : []),
                    {
                        id: 'close',
                        text: 'Закрыть',
                        action: 'close'
                    }
                ]
            });
        }
    }
};