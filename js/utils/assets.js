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
}

window.Assets = Assets;