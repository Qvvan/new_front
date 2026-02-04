/** Форматирование даты */
export function formatDate(date: Date | string, format: 'short' | 'long' | 'relative' = 'short'): string {
  const d = new Date(date);
  const now = new Date();

  if (format === 'relative') {
    const dateStr = d.toDateString();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (dateStr === todayStr) return 'сегодня';
    if (dateStr === yesterdayStr) return 'вчера';

    const diffTime = d.getTime() - now.getTime();
    const diffDays = Math.floor(Math.abs(diffTime) / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) return `${diffDays} ${pluralize(diffDays, ['день', 'дня', 'дней'])} назад`;
    if (diffDays <= 30) return `${Math.floor(diffDays / 7)} ${pluralize(Math.floor(diffDays / 7), ['неделю', 'недели', 'недель'])} назад`;
    if (diffDays <= 365) return `${Math.floor(diffDays / 30)} ${pluralize(Math.floor(diffDays / 30), ['месяц', 'месяца', 'месяцев'])} назад`;
    return `${Math.floor(diffDays / 365)} ${pluralize(Math.floor(diffDays / 365), ['год', 'года', 'лет'])} назад`;
  }

  const options: Intl.DateTimeFormatOptions = format === 'long'
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short' };
  return new Intl.DateTimeFormat('ru-RU', options).format(d);
}

/** Дней до даты */
export function daysBetween(targetDate: Date | string): number {
  const target = new Date(targetDate);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Форматирование цены */
export function formatPrice(price: number, currency = 'RUB'): string {
  if (!price || price === 0) return '0 ₽';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/** Склонение */
export function pluralize(count: number, forms: [string, string, string]): string {
  const cases = [2, 0, 1, 1, 1, 2];
  const index = (count % 100 > 4 && count % 100 < 20) ? 2 : cases[Math.min(count % 10, 5)];
  return forms[index];
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function throttle<T extends (...args: unknown[]) => void>(fn: T, limit: number): T {
  let inThrottle = false;
  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  } as T;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    const result = document.execCommand('copy');
    textArea.remove();
    return result;
  } catch {
    return false;
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

/** Формат "через X часов Y минут" до даты */
export function formatTimeUntil(dateString: string | undefined): string {
  if (!dateString) return 'Скоро';
  const target = new Date(dateString);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 'Доступно';
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `через ${days} ${pluralize(days, ['день', 'дня', 'дней'])}`;
  if (hours > 0) return `через ${hours} ${pluralize(hours, ['час', 'часа', 'часов'])} ${minutes % 60} мин`;
  if (minutes > 0) return `через ${minutes} ${pluralize(minutes, ['минуту', 'минуты', 'минут'])}`;
  return 'Скоро';
}
