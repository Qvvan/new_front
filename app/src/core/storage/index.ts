const PREFIX = 'dragon_vpn_';
const PERSISTENT_KEYS = ['settings', 'instructions_state', 'device_preferences'] as const;

const session = new Map<string, unknown>();

function getFromLocal(key: string, defaultValue: unknown = null): unknown {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setToLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const storage = {
  async get(key: string, defaultValue: unknown = null, useSession = true): Promise<unknown> {
    if (useSession && session.has(key)) return session.get(key);
    if (PERSISTENT_KEYS.includes(key as (typeof PERSISTENT_KEYS)[number])) {
      const stored = getFromLocal(PREFIX + key, defaultValue);
      if (stored !== null) {
        session.set(key, stored);
        return stored;
      }
    }
    return defaultValue;
  },

  async set(key: string, value: unknown, persist = false): Promise<boolean> {
    session.set(key, value);
    if (persist && PERSISTENT_KEYS.includes(key as (typeof PERSISTENT_KEYS)[number])) {
      return setToLocal(PREFIX + key, value);
    }
    return true;
  },

  getSubscriptions: () => (session.get('subscriptions') as unknown[]) ?? [],
  setSubscriptions: (v: unknown[]) => { session.set('subscriptions', v); },

  getPendingPayments: () => (session.get('pending_payments') as unknown[]) ?? [],
  async addPendingPayment(payment: { id: string; payment_id?: string; payment_url?: string; url?: string; confirmation_url?: string }) {
    if (!payment?.id) return;
    const pending = storage.getPendingPayments() as { id: string; payment_id?: string; payment_url?: string; url?: string }[];
    if (pending.some(p => p.id === payment.id)) return;
    pending.push({
      id: payment.id,
      payment_id: payment.payment_id,
      payment_url: payment.payment_url ?? payment.url ?? payment.confirmation_url ?? '',
      url: payment.url ?? '',
    });
    session.set('pending_payments', pending);
  },
  removePendingPayment: (paymentId: string) => {
    const pending = (storage.getPendingPayments() as { id?: string; payment_id?: string }[]).filter(
      p => p.id !== paymentId && p.payment_id !== paymentId
    );
    session.set('pending_payments', pending);
  },
  clearPendingPayments: () => session.set('pending_payments', []),

  async getSettings() {
    const defaultSettings = { notifications: true, hapticFeedback: true, language: 'ru', theme: 'dark' };
    return (await storage.get('settings', defaultSettings, false)) as typeof defaultSettings;
  },
  async setSettings(s: object) {
    return storage.set('settings', s, true);
  },

  clearSession: () => session.clear(),
};
