window.Loading = {
    overlay: null,
    isVisible: false,
    currentTimeout: null,

    /**
     * Инициализация системы загрузки
     */
    init() {
        this.createOverlay();
    },

    /**
     * Создание overlay для загрузки
     */
    createOverlay() {
        this.overlay = document.getElementById('loadingOverlay');
        if (!this.overlay) {
            this.overlay = Utils.createElement('div', {
                id: 'loadingOverlay',
                className: 'loading-overlay hidden'
            }, `
                <div class="loading-spinner"></div>
                <div class="loading-text">Загрузка...</div>
            `);
            document.body.appendChild(this.overlay);
        }
    },

    /**
     * Показать загрузку
     * @param {string} text - Текст загрузки
     * @param {number} timeout - Автоматическое скрытие через timeout мс
     */
    show(text = 'Загрузка...', timeout = null) {
        if (!this.overlay) {
            this.createOverlay(); // Принудительно создаем если не существует
        }

        if (this.isVisible) {
            this.updateText(text);
            return;
        }

        this.updateText(text);
        this.overlay.classList.remove('hidden');
        this.isVisible = true;

        // Автоматическое скрытие
        if (timeout) {
            this.currentTimeout = setTimeout(() => {
                this.hide();
            }, timeout);
        }
    },

    /**
     * Скрыть загрузку
     */
    hide() {
        if (!this.isVisible) return;

        this.overlay.classList.add('hidden');
        this.isVisible = false;

        // Очищаем таймаут
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
    },

    /**
     * Обновить текст загрузки
     */
    updateText(text) {
        if (!this.overlay) {
            console.warn('Loading overlay not initialized');
            return;
        }

        const textElement = this.overlay.querySelector('.loading-text');
        if (textElement) {
            textElement.textContent = text;
        } else {
            console.warn('Loading text element not found');
        }
    },

    /**
     * Показать загрузку с прогрессом
     * @param {string} text - Текст загрузки
     * @param {number} progress - Прогресс от 0 до 100
     */
    showWithProgress(text = 'Загрузка...', progress = 0) {
        if (!this.isVisible) {
            this.show(text);
        }

        // Добавляем прогресс бар если его нет
        let progressBar = this.overlay.querySelector('.loading-progress');
        if (!progressBar) {
            progressBar = Utils.createElement('div', {
                className: 'loading-progress'
            }, `
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: 0%"></div>
                </div>
                <div class="progress-text">0%</div>
            `);

            const textElement = this.overlay.querySelector('.loading-text');
            if (textElement) {
                textElement.parentNode.insertBefore(progressBar, textElement.nextSibling);
            }
        }

        // Обновляем прогресс
        this.updateProgress(progress);
        this.updateText(text);
    },

    /**
     * Обновить прогресс
     */
    updateProgress(progress) {
        const progressFill = this.overlay.querySelector('.progress-bar-fill');
        const progressText = this.overlay.querySelector('.progress-text');

        const clampedProgress = Math.max(0, Math.min(100, progress));

        if (progressFill) {
            progressFill.style.width = `${clampedProgress}%`;
        }

        if (progressText) {
            progressText.textContent = `${Math.round(clampedProgress)}%`;
        }
    },

    /**
     * Быстрые методы для типичных операций
     */

    // Загрузка данных
    showData(entity = 'данных') {
        this.show(`Загрузка ${entity}...`);
    },

    // Сохранение
    showSaving(entity = 'данных') {
        this.show(`Сохранение ${entity}...`);
    },

    // Отправка
    showSending() {
        this.show('Отправка...');
    },

    // Обработка платежа
    showPayment() {
        this.show('Обработка платежа...');
    },

    // Подключение к серверу
    showConnecting() {
        this.show('Подключение к серверу...');
    },

    // Генерация ключей
    showGeneratingKeys() {
        this.show('Генерация VPN ключей...');
    },

    // Активация подписки
    showActivating() {
        this.show('Активация подписки...');
    },

    /**
     * Показать загрузку с анимированными точками
     */
    showAnimated(baseText = 'Загрузка') {
        let dots = 0;
        const maxDots = 3;

        const animate = () => {
            if (!this.isVisible) return;

            dots = (dots + 1) % (maxDots + 1);
            const dotsText = '.'.repeat(dots);
            this.updateText(`${baseText}${dotsText}`);

            setTimeout(animate, 500);
        };

        this.show(baseText);
        animate();
    },

    /**
     * Показать загрузку с пошаговым прогрессом
     */
    showSteps(steps, currentStep = 0) {
        const stepText = currentStep < steps.length
            ? steps[currentStep]
            : 'Завершение...';

        const progress = currentStep < steps.length
            ? (currentStep / steps.length) * 100
            : 100;

        this.showWithProgress(stepText, progress);
    },

    /**
     * Асинхронная обертка для операций с загрузкой
     */
    async withLoading(operation, text = 'Загрузка...') {
        try {
            this.show(text);
            const result = await operation();
            return result;
        } finally {
            this.hide();
        }
    },

    /**
     * Обертка с прогрессом для операций
     */
    async withProgress(operation, text = 'Обработка...', progressCallback = null) {
        try {
            this.showWithProgress(text, 0);

            if (progressCallback) {
                const result = await operation(progressCallback);
                return result;
            } else {
                const result = await operation();
                return result;
            }
        } finally {
            this.hide();
        }
    },

    /**
     * Симуляция загрузки с прогрессом
     */
    async simulateProgress(duration = 2000, text = 'Загрузка...') {
        return new Promise((resolve) => {
            this.showWithProgress(text, 0);

            const startTime = Date.now();
            const updateProgress = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min((elapsed / duration) * 100, 100);

                this.updateProgress(progress);

                if (progress >= 100) {
                    setTimeout(() => {
                        this.hide();
                        resolve();
                    }, 300);
                } else {
                    requestAnimationFrame(updateProgress);
                }
            };

            updateProgress();
        });
    },

    /**
     * Проверка состояния
     */
    isShowing() {
        return this.isVisible;
    },

    /**
     * Принудительное скрытие (для экстренных случаев)
     */
    forceHide() {
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }

        this.overlay.classList.add('hidden');
        this.isVisible = false;

        // Удаляем прогресс бар если есть
        const progressBar = this.overlay.querySelector('.loading-progress');
        if (progressBar) {
            progressBar.remove();
        }
    },

    /**
     * Установка кастомного контента загрузки
     */
    setCustomContent(content) {
        const spinner = this.overlay.querySelector('.loading-spinner');
        const text = this.overlay.querySelector('.loading-text');
        const progress = this.overlay.querySelector('.loading-progress');

        // Очищаем старый контент
        if (spinner) spinner.remove();
        if (text) text.remove();
        if (progress) progress.remove();

        // Добавляем новый контент
        this.overlay.innerHTML = content;
    },

    /**
     * Восстановление стандартного контента
     */
    restoreDefaultContent() {
        this.overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Загрузка...</div>
        `;
    },

    /**
     * Специальные загрузки для различных операций приложения
     */

    // Загрузка подписок
    async loadSubscriptions() {
        return this.withLoading(
            () => window.SubscriptionAPI?.listSubscriptions(),
            'Загрузка подписок...'
        );
    },

    // Загрузка ключей
    async loadKeys() {
        return this.withLoading(
            () => window.KeysAPI?.getKeys(),
            'Загрузка VPN ключей...'
        );
    },

    // Загрузка рефералов
    async loadReferrals() {
        return this.withLoading(
            () => window.ReferralAPI?.listReferrals(),
            'Загрузка рефералов...'
        );
    },

    // Загрузка платежей
    async loadPayments() {
        return this.withLoading(
            () => window.PaymentAPI?.listPayments(),
            'Загрузка истории платежей...'
        );
    },

    // Загрузка тарифов
    async loadServices() {
        return this.withLoading(
            () => window.ServiceAPI?.getServices(),
            'Загрузка тарифов...'
        );
    },

    /**
     * Очистка системы загрузки
     */
    cleanup() {
        this.forceHide();

        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }

        this.overlay = null;
        this.isVisible = false;
        this.currentTimeout = null;
    }
};