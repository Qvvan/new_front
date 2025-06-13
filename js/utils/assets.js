class Assets {
    static basePath = 'assets/';

    static getImage(path) {
        return `${this.basePath}images/${path}`;
    }

    static getGif(name) {
        return this.getImage(`gifs/${name}`);
    }

    static getIcon(name) {
        return this.getImage(`icons/${name}`);
    }

    // Предзагрузка важных ассетов
    static async preloadAssets() {
        const criticalAssets = [
            // Основные GIF для навигации
            this.getGif('vpn-access.gif'),
            this.getGif('profile-tab.gif'),
            this.getGif('keys-tab.gif'),
            
            // GIF для подписки
            this.getGif('gift-animate.gif'),
            this.getGif('gift-opened.png'),
            this.getGif('auto-renewal.gif'),
            this.getGif('management.gif'),
            
            // GIF для рефералов
            this.getGif('referral-invite.gif'),
            this.getGif('telegram-share.gif'),
            this.getGif('story-share.gif'),
            
            // Пустые состояния
            this.getGif('empty-profiles.gif'),
            this.getGif('empty-referrals.gif')
        ];

        // Предзагрузка через MediaCache с прогрессом
        let loaded = 0;
        const total = criticalAssets.length;

        await Promise.all(criticalAssets.map(async (src) => {
            await window.MediaCache.load(src);
            loaded++;
            
            // Обновляем прогресс загрузки
            if (window.Loading) {
                const progress = Math.round((loaded / total) * 100);
                window.Loading.showWithProgress('Предзагрузка ресурсов...', progress);
            }
        }));
        
        Utils.log('info', `✅ Preloaded ${loaded}/${total} critical assets`);
    }
}

window.Assets = Assets;