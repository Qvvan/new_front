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

        // Наблюдаем за новыми изображениями через MutationObserver
        this.setupMutationObserver();
    },

    // Конвертируем обычные img в ленивые
    convertImages() {
        // Находим все изображения: PNG, GIF, JPG и из папки assets/images
        const images = document.querySelectorAll('img[src*=".png"], img[src*=".PNG"], img[src*=".gif"], img[src*=".jpg"], img[src*=".jpeg"], img[src*="/assets/images/"]');

        images.forEach(img => {
            const originalSrc = img.src || img.getAttribute('src');
            if (!originalSrc) return;

            // Пропускаем если уже обработано (есть blob URL или data-src уже установлен)
            if (originalSrc.startsWith('data:') || originalSrc.startsWith('blob:') || img.dataset.src) {
                return;
            }

            // Пропускаем если уже загружено
            if (img.classList.contains('loaded')) {
                return;
            }

            // Загружаем через MediaCache для кеширования
            if (window.MediaCache && (originalSrc.includes('.png') || originalSrc.includes('.PNG') || 
                originalSrc.includes('.gif') || originalSrc.includes('.jpg') || originalSrc.includes('.jpeg'))) {
                window.MediaCache.setSrc(img, originalSrc).then(() => {
                    img.classList.add('loaded');
                }).catch(() => {
                    // Fallback если загрузка не удалась
                    img.classList.add('loaded');
                });
            } else {
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
    },

    // ✅ ОПТИМИЗАЦИЯ: Настройка MutationObserver с throttle для снижения нагрузки
    setupMutationObserver() {
        if (!('MutationObserver' in window)) return;

        // ✅ Используем throttle для обработки мутаций
        let pendingMutations = [];
        const processMutations = Utils.throttle(() => {
            const nodesToProcess = new Set();
            
            pendingMutations.forEach(mutation => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        nodesToProcess.add(node);
                    }
                });
            });

            nodesToProcess.forEach(node => {
                // Обрабатываем новые изображения с data-src
                const images = node.querySelectorAll ? node.querySelectorAll('img[data-src]') : [];
                images.forEach(img => {
                    // Пропускаем если уже загружено
                    if (img.classList.contains('loaded') || !img.dataset.src) {
                        return;
                    }
                    
                    if (this.observer) {
                        this.observer.observe(img);
                    } else {
                        this.loadImage(img);
                    }
                });

                // Если сам узел - изображение с data-src
                if (node.tagName === 'IMG' && node.dataset.src && !node.classList.contains('loaded')) {
                    if (this.observer) {
                        this.observer.observe(node);
                    } else {
                        this.loadImage(node);
                    }
                }
            });

            pendingMutations = [];
        }, 100); // Обрабатываем мутации раз в 100ms

        const mutationObserver = new MutationObserver((mutations) => {
            // ✅ Накапливаем мутации и обрабатываем батчами
            if (!document.hidden) {
                pendingMutations.push(...mutations);
                processMutations();
            }
        });

        const handleVisibilityChange = () => {
            if (document.hidden) {
                mutationObserver.disconnect();
            } else {
                mutationObserver.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        if (!document.hidden) {
            mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    },

    // Обработка новых изображений после динамического рендеринга
    processNewImages(container = document) {
        const images = container.querySelectorAll('img[data-src]');
        images.forEach(img => {
            // Пропускаем если уже загружено или обрабатывается
            if (img.classList.contains('loaded') || !img.dataset.src) {
                return;
            }

            // Если есть observer - добавляем к наблюдению
            if (this.observer) {
                this.observer.observe(img);
            } else {
                // Если observer недоступен - загружаем сразу
                this.loadImage(img);
            }
        });
    }
};

// Автозапуск
document.addEventListener('DOMContentLoaded', () => {
    window.SimpleLazy.init();
});