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
    static preloadAssets() {
        const criticalAssets = [
            this.getGif('gift-animate.gif'),
            this.getGif('gift-opened.png'),
            this.getGif('auto-renewal.gif'),      // Новая гифка
            this.getGif('management.gif')         // Новая гифка
        ];

        criticalAssets.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    }
}

window.Assets = Assets;