class Assets {
    static basePath = 'assets/';

    static getImage(path) {
        return `${this.basePath}images/${path}`;
    }

    static getTGS(name) {
        return this.getImage(`gifs/${name}.tgs`);
    }

    static getStaticGif(name) {
        return this.getImage(`gifs/${name}`);
    }

    static getIcon(name) {
        return this.getImage(`icons/${name}`);
    }

    /**
     * 🔄 Предзагрузка смешанных ассетов
     */
    static async preloadAssets() {
        // TGS файлы загружаем через TGSLoader
        if (window.TGSLoader) {
            await window.TGSLoader.initialize();
        }

        // PNG файлы загружаем через MediaCache
        if (window.MediaCache) {
            const staticImages = [
                this.getStaticGif('gift-opened.png'),
                // добавьте другие PNG файлы
            ];

            await Promise.allSettled(
                staticImages.map(src => window.MediaCache.loadImageSafely(src))
            );
        }

        console.log('✅ Все ассеты предзагружены');
    }
}

window.Assets = Assets;