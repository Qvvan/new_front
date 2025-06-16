/**
 * Простая ленивая загрузка - 30 строк
 * Автоматически конвертирует все изображения
 */
window.SimpleLazy = {
    observer: null,

    init() {
        // Конвертируем все существующие изображения
        this.convertImages();

        // Создаем observer для новых изображений
        this.createObserver();
    },

    // Конвертируем обычные img в ленивые
    convertImages() {
        const images = document.querySelectorAll('img[src*=".gif"], img[src*="/assets/images/"]');

        images.forEach(img => {
            if (img.src.includes('.gif')) {
                const originalSrc = img.src;
                window.MediaCache.setSrc(img, originalSrc).then(() => {
                    img.classList.add('loaded');
                });
            } else {
                img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                img.classList.add('loaded');
            }
            img.classList.add('lazy-img');
        });
    },

    // Создаем Intersection Observer
    createObserver() {
        if (!('IntersectionObserver' in window)) {
            // Fallback - загружаем все сразу
            document.querySelectorAll('[data-src]').forEach(img => this.loadImage(img));
            return;
        }

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                    this.observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '50px' });

        // Наблюдаем за всеми ленивыми изображениями
        document.querySelectorAll('[data-src]').forEach(img => {
            this.observer.observe(img);
        });
    },

    // Загружаем изображение
    async loadImage(img) {
        const src = img.dataset.src;
        if (!src) return;

        // Показываем загрузку
        img.style.opacity = '0.5';

        // Загружаем через MediaCache
        if (window.MediaCache) {
            await window.MediaCache.setSrc(img, src);
        } else {
            img.src = src;
        }

        // Плавное появление
        img.style.transition = 'opacity 0.3s';
        img.style.opacity = '1';
        img.removeAttribute('data-src');
    }
};

// Автозапуск
document.addEventListener('DOMContentLoaded', () => {
    window.SimpleLazy.init();
});