// js/screens/keys.js - МИНИМАЛИСТИЧНАЯ ВЕРСИЯ
window.KeysScreen = {
    subscriptions: [],
    allKeys: [],
    servers: [],
    activeTab: 'servers',
    isLoaded: false,

    async init() {
        await this.loadData();
        this.render();
        this.setupEventListeners();
        this.isLoaded = true;
    },

    async loadData() {
        try {
            // Загружаем подписки
            const subscriptionsResponse = await window.SubscriptionAPI.listSubscriptions();
            this.subscriptions = Array.isArray(subscriptionsResponse) ? subscriptionsResponse : (subscriptionsResponse.subscriptions || []);

            // Получаем user_id текущего пользователя
            let userId = null;
            try {
                const user = await window.UserAPI?.getCurrentUser?.();
                userId = user?.telegram_id ?? user?.user_id ?? user?.id;
            } catch (e) {
                // Игнорируем
            }

            // Загружаем ключи через /user-keys (приоритет) или legacy /keys
            this.allKeys = [];
            for (const subscription of this.subscriptions) {
                try {
                    const subId = subscription.subscription_id ?? subscription.id;
                    let keys = [];

                    if (userId && subId && window.KeysAPI.getUserKeys) {
                        const keysResponse = await window.KeysAPI.getUserKeys(userId, subId);
                        const rawKeys = keysResponse.keys || [];
                        // API возвращает массив строк "vless://..."
                        keys = rawKeys.map(k => (typeof k === 'string' ? { key: k } : k));
                    } else {
                        const keysResponse = await window.KeysAPI.getKeys(subId);
                        keys = keysResponse.keys || [];
                    }

                    keys.forEach(key => {
                        const keyObj = typeof key === 'string' ? { key } : key;
                        keyObj.subscription = subscription;
                        keyObj.subscription_id = subId;
                        this.allKeys.push(keyObj);
                    });
                } catch (error) {
                    // Игнорируем ошибки загрузки ключей по подписке
                }
            }

            // Загружаем серверы
            try {
                if (window.ServersAPI) {
                    const serversResponse = await window.ServersAPI.getServers();
                    this.servers = Array.isArray(serversResponse) ? serversResponse : (serversResponse.servers || []);
                }
            } catch (error) {
                
                this.servers = [];
            }

        } catch (error) {
            
            this.subscriptions = [];
            this.allKeys = [];
            this.servers = [];
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
            case 'install-profile':
                await this.installProfile(data.configLink);
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

            // ✅ ИСПРАВЛЕНИЕ: Инициализируем анимации при смене вкладки
            setTimeout(() => {
                this.initializeTGSAnimations();
            }, 100);
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

    async installProfile(configLink) {
        if (!configLink) return;

        // Deeplink для установки профиля
        if (window.TelegramApp) {
            window.TelegramApp.openLink(configLink);
        } else {
            window.open(configLink, '_blank');
        }

        if (window.Toast) {
            window.Toast.success('Открываем установку профиля...');
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

        // Инициализируем анимации сразу без задержки
        this.initializeTGSAnimations();

        this.animateElements();
    },

    initializeTGSAnimations() {
            window.TGSLoader?.initializeScreen('keys');
        },

        cleanupTGSAnimations() {
            window.TGSLoader?.cleanupScreen('keys');
        },

    renderHeader() {
        return `
            <div class="section">
                <h2 class="section-title">
                    <div id="vpn-access-animation" style="width: 32px; height: 32px; display: inline-block; margin-right: 8px;"></div>
                    VPN Доступ
                </h2>
            </div>
        `;
    },

    renderTabs() {
        return `
            <div class="tabs">
                <div class="tabs-nav">
                    <button class="tab-button ${this.activeTab === 'servers' ? 'active' : ''}"
                            data-action="switch-tab"
                            data-tab="servers">
                        <i class="fas fa-server"></i>
                        Сервера
                    </button>
                    <button class="tab-button ${this.activeTab === 'keys' ? 'active' : ''}"
                            data-action="switch-tab"
                            data-tab="keys">
                        <div id="keys-tab-animation" style="width: 24px; height: 24px;"></div>
                        Ключи
                    </button>
                </div>
            </div>
        `;
    },

    renderTabContent() {
        if (this.activeTab === 'servers') {
            return this.renderServersTab();
        } else if (this.activeTab === 'keys') {
            return this.renderKeysTab();
        } else {
            return this.renderProfilesTab();
        }
    },

    /**
     * ВКЛАДКА СЕРВЕРОВ
     */
    renderServersTab() {
        if (this.servers.length === 0) {
            return `
                <div class="empty-state-card">
                    <div class="empty-state-content">
                        <div class="empty-state-icon">
                            <i class="fas fa-server" style="font-size: 48px; opacity: 0.3;"></i>
                        </div>
                        <h3 class="empty-state-title">Серверы временно недоступны</h3>
                        <p class="empty-state-text">Ведутся технические работы</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="servers-list">
                ${this.servers.map((server, index) => {
                    const card = this.renderServerItem(server);
                    // Добавляем задержку анимации для эффекта появления по очереди
                    return card.replace(
                        'class="server-card"',
                        `class="server-card" style="animation-delay: ${index * 0.1}s"`
                    );
                }).join('')}
            </div>
        `;
    },

    renderServerItem(server) {
        const loadPercentage = server.current_users && server.max_users 
            ? Math.round((server.current_users / server.max_users) * 100) 
            : 0;
        
        const hasLoadData = server.current_users !== undefined && server.max_users !== undefined;
        const loadText = hasLoadData
            ? `${server.current_users} из ${server.max_users}`
            : 'Неизвестно';

        const countryFlag = this.getCountryFlag(server.country || server.name);
        const serverName = server.name || server.country || 'VPN Сервер';

        // Определяем цвет статуса
        let statusColor = 'unknown';
        if (hasLoadData) {
            if (loadPercentage >= 80) {
                statusColor = 'high';
            } else if (loadPercentage >= 50) {
                statusColor = 'medium';
            } else {
                statusColor = 'low';
            }
        }

        return `
            <div class="server-card" data-server-id="${server.server_id || server.id}">
                <div class="server-card-content">
                    <div class="server-card-header">
                        <div class="server-flag-wrapper">
                            <div class="server-flag-large">${countryFlag}</div>
                        </div>
                        <div class="server-title-section">
                            <h3 class="server-card-name">${serverName}</h3>
                        </div>
                    </div>
                    
                    <div class="server-card-body">
                        <div class="server-load-section">
                            ${hasLoadData ? `
                                <div class="server-load-info">
                                    <span class="server-load-text">Нагрузка: ${loadText}</span>
                                    <div class="server-load-bar-container">
                                        <div class="server-load-bar">
                                            <div class="server-load-fill ${statusColor}" style="width: ${loadPercentage}%">
                                                <div class="server-load-shine"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ` : `
                                <div class="server-load-unknown">
                                    <span class="server-load-text">Нагрузка: <span class="unknown-text">${loadText}</span></span>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    getCountryFlag(countryName) {
        if (!countryName) return '🌐';
        
        // Коды стран (ISO 3166-1 alpha-2) - приоритетная проверка
        const countryCodes = {
            'nl': '🇳🇱', // Нидерланды
            'de': '🇩🇪', // Германия
            'fr': '🇫🇷', // Франция
            'se': '🇸🇪', // Швеция
            'fi': '🇫🇮', // Финляндия
            'ch': '🇨🇭', // Швейцария
            'no': '🇳🇴', // Норвегия
            'gb': '🇬🇧', 'uk': '🇬🇧', // Великобритания
            'us': '🇺🇸', // США
            'ca': '🇨🇦', // Канада
            'jp': '🇯🇵', // Япония
            'ru': '🇷🇺', // Россия
            'sg': '🇸🇬', // Сингапур
            'pl': '🇵🇱', // Польша
            'it': '🇮🇹', // Италия
            'es': '🇪🇸', // Испания
            'ie': '🇮🇪', // Ирландия
            'be': '🇧🇪', // Бельгия
            'at': '🇦🇹', // Австрия
            'dk': '🇩🇰', // Дания
            'cz': '🇨🇿', // Чехия
            'ro': '🇷🇴', // Румыния
            'bg': '🇧🇬', // Болгария
            'gr': '🇬🇷', // Греция
            'pt': '🇵🇹', // Португалия
            'hu': '🇭🇺', // Венгрия
            'sk': '🇸🇰', // Словакия
            'si': '🇸🇮', // Словения
            'ee': '🇪🇪', // Эстония
            'lv': '🇱🇻', // Латвия
            'lt': '🇱🇹', // Литва
            'au': '🇦🇺', // Австралия
            'nz': '🇳🇿', // Новая Зеландия
            'br': '🇧🇷', // Бразилия
            'mx': '🇲🇽', // Мексика
            'ar': '🇦🇷', // Аргентина
            'kr': '🇰🇷', // Южная Корея
            'cn': '🇨🇳', // Китай
            'in': '🇮🇳', // Индия
            'tr': '🇹🇷', // Турция
            'za': '🇿🇦', // ЮАР
            'eg': '🇪🇬', // Египет
            'ae': '🇦🇪', // ОАЭ
            'il': '🇮🇱', // Израиль
            'th': '🇹🇭', // Таиланд
            'vn': '🇻🇳', // Вьетнам
            'ph': '🇵🇭', // Филиппины
            'id': '🇮🇩', // Индонезия
            'my': '🇲🇾', // Малайзия
        };
        
        // Полные названия стран
        const countryFlags = {
            'нидерланды': '🇳🇱', 'netherlands': '🇳🇱', 'голландия': '🇳🇱',
            'германия': '🇩🇪', 'germany': '🇩🇪',
            'франция': '🇫🇷', 'france': '🇫🇷',
            'швеция': '🇸🇪', 'sweden': '🇸🇪',
            'финляндия': '🇫🇮', 'finland': '🇫🇮',
            'швейцария': '🇨🇭', 'switzerland': '🇨🇭',
            'норвегия': '🇳🇴', 'norway': '🇳🇴',
            'великобритания': '🇬🇧', 'uk': '🇬🇧', 'united kingdom': '🇬🇧',
            'сша': '🇺🇸', 'usa': '🇺🇸', 'united states': '🇺🇸',
            'канада': '🇨🇦', 'canada': '🇨🇦',
            'япония': '🇯🇵', 'japan': '🇯🇵',
            'россия': '🇷🇺', 'russia': '🇷🇺',
            'сингапур': '🇸🇬', 'singapore': '🇸🇬'
        };

        const lowerName = countryName.toLowerCase().trim();
        
        // Сначала проверяем коды стран (точное совпадение)
        if (countryCodes[lowerName]) {
            return countryCodes[lowerName];
        }
        
        // Затем проверяем полные названия (частичное совпадение)
        for (const [country, flag] of Object.entries(countryFlags)) {
            if (lowerName.includes(country) || country.includes(lowerName)) {
                return flag;
            }
        }

        return '🌐';
    },

    /**
     * ВКЛАДКА ПРОФИЛЕЙ (скрыта, используется только для ключей)
     */
    renderProfilesTab() {
        // Эта вкладка больше не используется, но оставляем для совместимости
        return this.renderKeysTab();
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
        // Проверяем наличие активной подписки
        const hasActiveSubscription = this.subscriptions.some(sub => {
            const daysLeft = Utils.daysBetween(sub.end_date);
            return daysLeft > 0 && (sub.status === 'active' || sub.is_active);
        });

        if (!hasActiveSubscription) {
            setTimeout(() => {
                this.initializeTGSAnimations();
            }, 100);

            return `
                <div class="empty-state-card">
                    <div class="empty-state-content">
                        <div class="empty-state-icon">
                            <div id="keys-empty-animation" style="width: 80px; height: 80px; margin: 0 auto;"></div>
                        </div>
                        <h3 class="empty-state-title">Доступно с подпиской</h3>
                        <p class="empty-state-text">Оформите подписку чтобы получить VPN ключи для подключения</p>
                        <button class="btn-subscription-purchase" data-action="go-to-subscription">
                            <div class="btn-purchase-bg"></div>
                            <div class="btn-purchase-content">
                                <i class="fas fa-bolt"></i>
                                <span>Оформить подписку</span>
                            </div>
                        </button>
                    </div>
                </div>
            `;
        }

        if (this.allKeys.length === 0) {
            return `
                <div class="empty-state-card">
                    <div class="empty-state-content">
                        <div class="empty-state-icon">
                            <i class="fas fa-key" style="font-size: 48px; opacity: 0.3;"></i>
                        </div>
                        <h3 class="empty-state-title">Нет ключей</h3>
                        <p class="empty-state-text">Ключи будут доступны после активации подписки</p>
                    </div>
                </div>
            `;
        }

        // Первый элемент - основной профиль VPN
        const mainProfile = this.subscriptions.find(sub => {
            const daysLeft = Utils.daysBetween(sub.end_date);
            return daysLeft > 0 && (sub.status === 'active' || sub.is_active) && sub.config_link;
        });

        let content = '';

        if (mainProfile) {
            const fullProfileUrl = `https://skydragonvpn.ru/sub/${mainProfile.config_link}`;
            content += `
                <div class="main-profile-card">
                    <div class="main-profile-header">
                        <h4>Основной профиль VPN</h4>
                        <span class="profile-status active">Активен</span>
                    </div>
                    <div class="main-profile-content">
                        <div class="profile-url-display">
                            <code>${this.getUrlPreview(fullProfileUrl)}</code>
                        </div>
                        <div class="profile-actions">
                            <button class="btn btn-sm btn-secondary" data-action="copy-profile" data-config-link="${fullProfileUrl}">
                                <i class="fas fa-copy"></i>
                                Скопировать
                            </button>
                            <button class="btn btn-sm btn-primary" data-action="install-profile" data-config-link="${fullProfileUrl}">
                                <i class="fas fa-download"></i>
                                Установить
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        const keysBySubscription = this.groupKeysBySubscription();

        return `
            <div class="keys-content">
                ${content}
                ${Object.entries(keysBySubscription).map(([subscriptionId, keys]) =>
                    this.renderKeysSubscription(subscriptionId, keys)
                ).join('')}
            </div>
        `;
    },

    groupKeysBySubscription() {
        const grouped = {};

        this.allKeys.forEach(key => {
            const subscriptionId = key.subscription_id ?? key.subscription?.id ?? key.subscription?.subscription_id ?? 'default';
            if (!grouped[subscriptionId]) {
                grouped[subscriptionId] = [];
            }
            grouped[subscriptionId].push(key);
        });

        return grouped;
    },

    renderKeysSubscription(subscriptionId, keys) {
        const subscription = this.subscriptions.find(s =>
            s.id === subscriptionId || s.subscription_id === subscriptionId
        );
        const serviceName = subscription ? this.getServiceName(subscription) : (subscriptionId === 'default' ? 'VPN Ключи' : 'Подписка');

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
        const keyValue = typeof key === 'string' ? key : (key?.key ?? '');
        const serverInfo = this.parseServerInfo(keyValue);

        return `
            <div class="key-row" data-action="copy-key" data-key="${this.escapeKeyForAttribute(keyValue)}">
                <div class="key-info">
                    <div class="key-name">
                        <span class="server-flag">${serverInfo.flag}</span>
                        <span class="key-label">${Utils.escapeHtml(serverInfo.name)}</span>
                    </div>
                    <div class="key-preview">${Utils.escapeHtml(this.getKeyPreview(keyValue))}</div>
                </div>
                <button class="copy-btn key-copy-btn" data-action="copy-key" data-key="${this.escapeKeyForAttribute(keyValue)}" type="button" title="Скопировать">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        `;
    },

    escapeKeyForAttribute(keyValue) {
        if (!keyValue) return '';
        return String(keyValue)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    getKeyPreview(keyValue) {
        if (!keyValue || keyValue.length < 60) return keyValue || '';
        return keyValue.substring(0, 50) + '…';
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
        this.servers = [];
        this.activeTab = 'servers';
        this.isLoaded = false;
    }
};