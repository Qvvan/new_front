class Assets {
    static basePath = 'assets/';

    static getImage(path) {
        return `${this.basePath}images/${path}`;
    }

    static getGif(name) {
        const url = this.getImage(`gifs/${name}`);
        return url;
    }

    static getIcon(name) {
        return this.getImage(`icons/${name}`);
    }

    // Предзагрузка важных ассетов
    static async preloadAssets() {
        const criticalAssets = [
            this.getGif('gift-animate.gif'),
            this.getGif('gift-opened.png'),
            this.getGif('auto-renewal.gif'),
            this.getGif('payment-pending.gif'),
            this.getGif('payment-success.gif'),
            this.getGif('management.gif')
        ];

        await Promise.all(criticalAssets.map(src => window.MediaCache.load(src)));
    }
}

window.Assets = Assets;