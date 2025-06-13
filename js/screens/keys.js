// js/screens/keys.js - МИНИМАЛИСТИЧНАЯ ВЕРСИЯ
window.KeysScreen = {
    subscriptions: [],
    allKeys: [],
    activeTab: 'profiles',
    isLoaded: false,

    async init() {
        Utils.log('info', 'Initializing Keys Screen');

        await this.loadData();
        this.render();
        this.setupEventListeners();
        this.isLoaded = true;
    },

    async loadData() {
        try {
            const subscriptionsResponse = await window.SubscriptionAPI.listSubscriptions();
            this.subscriptions = subscriptionsResponse.subscriptions || [];

            this.allKeys = [];

            for (const subscription of this.subscriptions) {
                try {
                    const keysResponse = await window.KeysAPI.getKeys(subscription.id);
                    const keys = keysResponse.keys || [];

                    keys.forEach(key => {
                        key.subscription = subscription;
                    });

                    this.allKeys.push(...keys);

                } catch (error) {
                    Utils.log('error', `Failed to get keys for subscription ${subscription.id}:`, error);
                }
            }

        } catch (error) {
            Utils.log('error', 'Failed to load data:', error);
            this.subscriptions = [];
            this.allKeys = [];

        }
    },

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const keysScreen = e.target.closest('#keysScreen');
            if (!keysScreen) return;

            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            this.handleAction(action, target.dataset);
        });
    },

    async handleAction(action, data) {
        if (window.TelegramApp) {
            window.TelegramApp.haptic.light();
        }

        switch (action) {
            case 'switch-tab':
                this.switchTab(data.tab);
                break;
            case 'copy-profile':
                await this.copyProfile(data.configLink);
                break;
            case 'copy-key':
                await this.copyKey(data.key);
                break;
            case 'go-to-subscription':
                window.Router.navigate('subscription');
                break;
        }
    },

    switchTab(tab) {
        if (this.activeTab === tab) return;

        this.activeTab = tab;

        const container = document.getElementById('tabContentContainer');
        if (container) {
            container.innerHTML = this.renderTabContent();
        }

        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        this.animateElements();
    },

    async copyProfile(configLink) {
        if (!configLink) {
            if (window.Toast) {
                window.Toast.warning('Профиль недоступен');
            }
            return;
        }

        const success = await Utils.copyToClipboard(configLink);

        if (success && window.Toast) {
            window.Toast.copied('Профиль скопирован');
        }
    },

    async copyKey(keyValue) {
        if (!keyValue) return;

        const success = await Utils.copyToClipboard(keyValue);

        if (success && window.Toast) {
            window.Toast.copied('Ключ скопирован');
        }
    },

    render() {
        const container = document.getElementById('keysScreen');
        if (!container) return;

        const content = `
            ${this.renderHeader()}
            ${this.renderTabs()}
            <div class="tab-content-container" id="tabContentContainer">
                ${this.renderTabContent()}
            </div>
        `;

        container.innerHTML = Utils.wrapContent(content);
        this.animateElements();
    },

    renderHeader() {
        return `
            <div class="section">
                <h2 class="section-title">
                    <img src="${window.Assets.getGif('vpn-access.gif')}" alt="VPN" class="section-title-gif" />
                    VPN Доступ
                </h2>
            </div>
        `;
    },

    renderTabs() {
        return `
            <div class="tabs">
                <div class="tabs-nav">
                    <button class="tab-button ${this.activeTab === 'profiles' ? 'active' : ''}"
                            data-action="switch-tab"
                            data-tab="profiles">
                        <img src="${window.Assets.getGif('profile-tab.gif')}" alt="Profiles" class="tab-gif" />
                        Профили
                    </button>
                    <button class="tab-button ${this.activeTab === 'keys' ? 'active' : ''}"
                            data-action="switch-tab"
                            data-tab="keys">
                        <img src="${window.Assets.getGif('keys-tab.gif')}" alt="Keys" class="tab-gif" />
                        Ключи
                    </button>
                </div>
            </div>
        `;
    },

    renderTabContent() {
        if (this.activeTab === 'profiles') {
            return this.renderProfilesTab();
        } else {
            return this.renderKeysTab();
        }
    },

    /**
     * ВКЛАДКА ПРОФИЛЕЙ
     */
    renderProfilesTab() {
        if (this.subscriptions.length === 0) {
            return `
                <div class="empty-state-card">
                    <div class="empty-state-content">
                        <div class="empty-state-icon">
                            <img src="${window.Assets.getGif('empty-profiles.gif')}" alt="Empty" class="empty-gif" />
                        </div>
                        <h3 class="empty-state-title">Нет профилей</h3>
                        <p class="empty-state-text">Оформите подписку чтобы получить VPN профили для подключения</p>
                        <button class="btn-empty-action" data-action="go-to-subscription">
                            <div class="btn-empty-bg"></div>
                            <div class="btn-empty-content">
                                <i class="fas fa-plus"></i>
                                <span>Оформить подписку</span>
                            </div>
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="keys-content">
                ${this.subscriptions.map(subscription => this.renderProfileSubscription(subscription)).join('')}
            </div>
        `;
    },

    renderProfileSubscription(subscription) {
        const serviceName = this.getServiceName(subscription);
        const daysLeft = Utils.daysBetween(subscription.end_date);
        const isExpired = daysLeft <= 0;
        const hasProfile = subscription.config_link && subscription.config_link.trim();
        const fullProfileUrl = hasProfile ? `https://skydragonvpn.ru/sub/${subscription.config_link}` : null;

        return `
            <div class="subscription-box ${isExpired ? 'expired' : ''}">
                <div class="subscription-header">
                    <div class="subscription-info">
                        <h4>${serviceName}</h4>
                        <span>${isExpired ? 'Истекла' : `${daysLeft} дн.`}</span>
                    </div>
                    ${hasProfile ?
                        '<i class="fas fa-check-circle status-ready"></i>' :
                        '<i class="fas fa-clock status-pending"></i>'
                    }
                </div>

                ${hasProfile ? `
                    <div class="profile-content">
                        <div class="profile-url">
                            <code>${this.getUrlPreview(fullProfileUrl)}</code>
                        </div>
                        <button class="copy-btn"
                                data-action="copy-profile"
                                data-config-link="${fullProfileUrl}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                ` : `
                    <div class="loading-content">
                        <div class="loading-dots">
                            <span></span><span></span><span></span>
                        </div>
                        <span>Генерируется...</span>
                    </div>
                `}
            </div>
        `;
    },

    /**
     * ВКЛАДКА КЛЮЧЕЙ
     */
    renderKeysTab() {
        if (this.allKeys.length === 0) {
            return `
                <div class="empty-state-card">
                    <div class="empty-state-content">
                        <div class="empty-state-icon">
                            <img src="${window.Assets.getGif('empty-profiles.gif')}" alt="Empty" class="empty-gif" />
                        </div>
                        <h3 class="empty-state-title">Нет ключей</h3>
                        <p class="empty-state-text">Получите доступ к VPN серверам оформив подписку</p>
                        <button class="btn-empty-action" data-action="go-to-subscription">
                            <div class="btn-empty-bg"></div>
                            <div class="btn-empty-content">
                                <i class="fas fa-rocket"></i>
                                <span>Начать использовать VPN</span>
                            </div>
                        </button>
                    </div>
                </div>
            `;
        }

        const keysBySubscription = this.groupKeysBySubscription();

        return `
            <div class="keys-content">
                ${Object.entries(keysBySubscription).map(([subscriptionId, keys]) =>
                    this.renderKeysSubscription(subscriptionId, keys)
                ).join('')}
            </div>
        `;
    },

    groupKeysBySubscription() {
        const grouped = {};

        this.allKeys.forEach(key => {
            const subscriptionId = key.subscription_id;
            if (!grouped[subscriptionId]) {
                grouped[subscriptionId] = [];
            }
            grouped[subscriptionId].push(key);
        });

        return grouped;
    },

    renderKeysSubscription(subscriptionId, keys) {
        const subscription = this.subscriptions.find(s => s.id === subscriptionId);
        const serviceName = subscription ? this.getServiceName(subscription) : 'Подписка';

        return `
            <div class="subscription-box">
                <div class="subscription-header">
                    <div class="subscription-info">
                        <h4>${serviceName}</h4>
                        <span>${keys.length} ${Utils.pluralize(keys.length, ['ключ', 'ключа', 'ключей'])}</span>
                    </div>
                </div>

                <div class="keys-list">
                    ${keys.map(key => this.renderKey(key)).join('')}
                </div>
            </div>
        `;
    },

    renderKey(key) {
        const serverInfo = this.parseServerInfo(key.key);

        return `
            <div class="key-row" data-action="copy-key" data-key="${Utils.escapeHtml(key.key)}">
                <div class="key-info">
                    <div class="key-name">
                        <span class="server-flag">${serverInfo.flag}</span>
                        <span>${serverInfo.name}</span>
                    </div>
                </div>
                <button class="copy-btn">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        `;
    },

    /**
     * ПАРСИНГ СЕРВЕРА И ФЛАГОВ
     */
    parseServerInfo(keyValue) {
        try {
            let serverName = 'VPN сервер';
            let flag = '🌐';

            // Извлекаем название из ключа (после #)
            const hashIndex = keyValue.lastIndexOf('#');
            if (hashIndex !== -1) {
                serverName = decodeURIComponent(keyValue.substring(hashIndex + 1));
            }

            // Определяем флаг по названию сервера
            flag = this.getCountryFlag(serverName);

            return {
                name: serverName,
                flag: flag
            };

        } catch (error) {
            return {
                name: 'VPN сервер',
                flag: '🌐'
            };
        }
    },

    getCountryFlag(serverName) {
        const countryFlags = {
            'нидерланды': '🇳🇱',
            'netherlands': '🇳🇱',
            'германия': '🇩🇪',
            'germany': '🇩🇪',
            'франция': '🇫🇷',
            'france': '🇫🇷',
            'швеция': '🇸🇪',
            'sweden': '🇸🇪',
            'финляндия': '🇫🇮',
            'finland': '🇫🇮',
            'швейцария': '🇨🇭',
            'switzerland': '🇨🇭',
            'норвегия': '🇳🇴',
            'norway': '🇳🇴',
            'великобритания': '🇬🇧',
            'uk': '🇬🇧',
            'сша': '🇺🇸',
            'usa': '🇺🇸',
            'канада': '🇨🇦',
            'canada': '🇨🇦',
            'япония': '🇯🇵',
            'japan': '🇯🇵'
        };

        const lowerName = serverName.toLowerCase();

        for (const [country, flag] of Object.entries(countryFlags)) {
            if (lowerName.includes(country)) {
                return flag;
            }
        }

        return '🌐';
    },

    getServiceName(subscription) {
        return subscription.service_name || `Подписка ${subscription.id.slice(0, 8)}`;
    },

    getUrlPreview(url) {
        if (!url || url.length < 50) return url;
        return `${url.substring(0, 45)}...`;
    },

    animateElements() {
        const elements = document.querySelectorAll('#keysScreen .subscription-box, #keysScreen .key-row');
        elements.forEach((el, index) => {
            el.classList.add('stagger-item');
            el.style.animationDelay = `${index * 0.05}s`;
        });
    },

    async refresh() {

        await this.loadData();
        this.render();

    },

    cleanup() {
        this.subscriptions = [];
        this.allKeys = [];
        this.activeTab = 'profiles';
        this.isLoaded = false;
    }
};