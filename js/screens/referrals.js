// js/screens/referrals.js
window.ReferralsScreen = {
    referrals: [],
    stats: {},
    referralLink: null,
    isLoaded: false,

    /**
     * Инициализация экрана рефералов
     */
    async init() {
        Utils.log('info', 'Initializing Referrals Screen');

        await this.loadData();
        this.setupEventListeners();
        this.render();
        this.isLoaded = true;
    },

    /**
     * Загрузка данных рефералов
     */
    async loadData() {
        try {
            const [referralsResponse, linkData] = await Promise.all([
                window.ReferralAPI.listReferrals(),           // → /referrals (содержит и список, и статистику)
                window.ReferralAPI.generateReferralLink()
            ]);

            this.referrals = referralsResponse.referrals || [];

            // ✅ Вычисляем статистику из полученных данных
            this.stats = this.calculateStatsFromReferrals(this.referrals, referralsResponse);
            this.referralLink = linkData;

        } catch (error) {
            Utils.log('error', 'Failed to load referrals data:', error);
            this.referrals = [];
            this.stats = { total_count: 0, invited: 0, partners: 0 };
            this.referralLink = await window.ReferralAPI.generateReferralLink();
        }
    },

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const referralsScreen = e.target.closest('#referralsScreen');
            if (!referralsScreen) return;

            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            this.handleAction(action, target.dataset);
        });
    },

    calculateStatsFromReferrals(referrals, response) {
        return {
            total_count: response.total_count || referrals.length,
            invited: referrals.filter(r => r.status === 'invited').length,
            partners: referrals.filter(r => r.status === 'partner').length
        };
    },

    /**
     * Обработка действий
     */
    async handleAction(action, data) {
        // Вибрация
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }

        switch (action) {
            case 'share-telegram':
                await this.shareToTelegram();
                break;
            case 'share-multiple':
                await this.shareToMultiple();
                break;
            case 'copy-link':
                await this.copyReferralLink();
                break;
            case 'share-story':
                await this.shareToStory();
                break;
            default:
                Utils.log('warn', 'Unknown referral action:', action);
        }
    },

    /**
     * Поделиться в Telegram
     */
    async shareToTelegram() {
        try {
            const message = this.generateShareMessage();

            // Используем switchInlineQuery для отправки нескольким пользователям
            if (window.TelegramApp?.webApp?.switchInlineQuery) {
                window.TelegramApp.webApp.switchInlineQuery(message, ['users', 'groups']);
            } else {
                // Fallback - обычная отправка
                const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(this.referralLink.link)}&text=${encodeURIComponent(message)}`;
                window.TelegramApp.openLink(shareUrl);
            }

            if (window.Toast) {
                window.Toast.success('Выберите контакты для отправки');
            }

        } catch (error) {
            Utils.log('error', 'Failed to share to Telegram:', error);
            if (window.Toast) {
                window.Toast.error('Ошибка отправки приглашения');
            }
        }
    },

    /**
     * Поделиться нескольким пользователям
     */
    async shareToMultiple() {
        try {
            const shareData = {
                title: 'Dragon VPN - Присоединяйся!',
                text: this.generateShareMessage(),
                url: this.referralLink.link
            };

            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback через Telegram
                await this.shareToTelegram();
            }

        } catch (error) {
            if (error.name !== 'AbortError') {
                Utils.log('error', 'Share failed:', error);
            }
        }
    },

    /**
     * Копировать ссылку
     */
    async copyReferralLink() {
        const success = await Utils.copyToClipboard(this.referralLink.link);

        if (success && window.Toast) {
            window.Toast.copied('Реферальная ссылка скопирована');
        }
    },

    /**
     * Поделиться в Stories
     */
    async shareToStory() {
        try {
            // Используем новый API для Stories (если доступен)
            if (window.TelegramApp?.webApp?.shareToStory) {
                const storyData = {
                    media_url: 'https://yourcdn.com/referral-story-bg.jpg', // Фон для сторис
                    text: `Присоединяйся к Dragon VPN!\n\nКод: ${this.referralLink.shortCode}`,
                    widget_link: {
                        url: this.referralLink.link,
                        name: '🚀 Присоединиться'
                    }
                };

                await window.TelegramApp.webApp.shareToStory(storyData);
            } else {
                // Fallback
                await this.shareToTelegram();
            }

        } catch (error) {
            Utils.log('error', 'Failed to share to story:', error);
            await this.shareToTelegram(); // Fallback
        }
    },

    /**
     * Генерация сообщения для отправки
     */
    generateShareMessage() {
        const userName = window.TelegramApp?.getUserInfo()?.first_name || 'Друг';

        return `🚀 ${userName} приглашает в Dragon VPN!

🎁 Получи бонусы при регистрации
🔒 Безлимитный VPN доступ
⚡ Высокая скорость подключения

${this.referralLink.link}`;
    },

    /**
     * Рендеринг экрана
     */
    render() {
        const container = document.getElementById('referralsScreen');
        if (!container) return;

        const content = `
            <!-- Заголовок с гифкой -->
            <div class="section">
                <h2 class="section-title">
                    <img src="${window.Assets.getGif('referral-invite.gif')}" alt="Invite" class="section-title-gif" />
                    Приглашай друзей
                </h2>
                <p class="section-subtitle">Получай бонусы за каждого друга</p>
            </div>

            <!-- Статистика -->
            ${this.renderStats()}

            <!-- Быстрые действия отправки -->
            ${this.renderShareActions()}

            <!-- Реферальная ссылка -->
            ${this.renderReferralLink()}

            <!-- Список рефералов -->
            ${this.renderReferralsList()}
        `;

        container.innerHTML = Utils.wrapContent(content);
        this.animateElements();
    },

    /**
     * Рендеринг статистики
     */
    renderStats() {
        return `
            <div class="referral-stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${this.stats.total_count || 0}</div>
                    <div class="stat-label">Всего друзей</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${this.stats.partners || 0}</div>
                    <div class="stat-label">Активных</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${this.calculateEarnings()}</div>
                    <div class="stat-label">Заработано</div>
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг действий для отправки
     */
    renderShareActions() {
        return `
            <div class="section">
                <div class="share-actions-grid">
                    <div class="share-action-card" data-action="share-telegram">
                        <div class="share-action-icon">
                            <img src="${window.Assets.getGif('telegram-share.gif')}" alt="Telegram" class="share-gif" />
                        </div>
                        <div class="share-action-title">Telegram</div>
                        <div class="share-action-subtitle">Нескольким друзьям</div>
                    </div>

                    <div class="share-action-card" data-action="share-story">
                        <div class="share-action-icon">
                            <img src="${window.Assets.getGif('story-share.gif')}" alt="Story" class="share-gif" />
                        </div>
                        <div class="share-action-title">Stories</div>
                        <div class="share-action-subtitle">В свою историю</div>
                    </div>

                    <div class="share-action-card" data-action="share-multiple">
                        <div class="share-action-icon">
                            <img src="${window.Assets.getGif('multiple-share.gif')}" alt="Multiple" class="share-gif" />
                        </div>
                        <div class="share-action-title">Другие</div>
                        <div class="share-action-subtitle">WhatsApp, VK...</div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг реферальной ссылки
     */
    renderReferralLink() {
        if (!this.referralLink) return '';

        return `
            <div class="section">
                <div class="referral-link-card">
                    <div class="referral-link-header">
                        <div class="referral-link-icon">
                            <i class="fas fa-link"></i>
                        </div>
                        <div class="referral-link-info">
                            <h4>Твоя ссылка-приглашение</h4>
                            <p>Код: ${this.referralLink.shortCode}</p>
                        </div>
                    </div>
                    <div class="referral-link-actions">
                        <button class="btn btn-sm btn-primary" data-action="copy-link">
                            <i class="fas fa-copy"></i>
                            Копировать
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг списка рефералов
     */
    renderReferralsList() {
        if (this.referrals.length === 0) {
            return `
                <div class="section">
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <img src="${window.Assets.getGif('empty-referrals.gif')}" alt="Empty" class="empty-gif" />
                        </div>
                        <h3 class="empty-state-title">Пока нет друзей</h3>
                        <p class="empty-state-text">Поделись ссылкой и начни зарабатывать бонусы</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="section">
                <h3 class="section-title">
                    <i class="fas fa-users"></i>
                    Твои друзья
                </h3>
                <div class="referrals-list">
                    ${this.referrals.map(referral => this.renderReferralItem(referral)).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Рендеринг элемента списка рефералов
     */
    renderReferralItem(referral) {
        const statusIcon = referral.status === 'partner' ? 'fas fa-crown' : 'fas fa-user-plus';
        const statusColor = referral.status === 'partner' ? 'text-green' : 'text-secondary';
        const statusText = referral.status === 'partner' ? 'Активен' : 'Приглашен';

        return `
            <div class="referral-item">
                <div class="referral-item-avatar">
                    <i class="${statusIcon} ${statusColor}"></i>
                </div>
                <div class="referral-item-info">
                    <div class="referral-item-name">${referral.firstname || 'Пользователь'}</div>
                    <div class="referral-item-status ${statusColor}">${statusText}</div>
                </div>
                <div class="referral-item-date">
                    ${Utils.formatDate(referral.joined_at, 'relative')}
                </div>
            </div>
        `;
    },

    /**
     * Вычисление заработка
     */
    calculateEarnings() {
        // Простая формула: активные рефералы * бонус
        const activeReferrals = this.stats.partners || 0;
        const bonusPerReferral = 100; // Можно вынести в конфиг
        return activeReferrals * bonusPerReferral;
    },

    /**
     * Анимация элементов
     */
    animateElements() {
        const elements = document.querySelectorAll('#referralsScreen .stat-card, #referralsScreen .share-action-card, #referralsScreen .referral-item');
        elements.forEach((el, index) => {
            el.classList.add('stagger-item');
            el.style.animationDelay = `${index * 0.1}s`;
        });
    },

    /**
     * Обновление данных
     */
    async refresh() {
        await this.loadData();
        this.render();
    },

    /**
     * Очистка
     */
    cleanup() {
        this.referrals = [];
        this.stats = {};
        this.referralLink = null;
        this.isLoaded = false;
    }
};