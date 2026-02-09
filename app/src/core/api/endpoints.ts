import { api } from './client';

export type ImportLinkApp = { app_name?: string; store_url?: string; import_url?: string };
export type ImportLinksMap = Record<string, ImportLinkApp[]>;

export const userApi = {
  register: (referrerId?: string | null) =>
    api.post<{ user?: unknown }>('/user', referrerId ? { referrer_id: referrerId } : {}),
  getCurrentUser: (forceRefresh = false) =>
    api.post<{ user?: unknown; telegram_id?: number; user_id?: number; id?: number }>('/user/user', {}, { cacheable: !forceRefresh }),
  updateLastSeen: () => api.post('/user/user/me/last-seen'),
};

export const subscriptionApi = {
  list: () => api.get<{ subscriptions?: unknown[] } | unknown[]>('/subscription/subscriptions/user'),
  get: (id: string | number) => api.get(`/subscriptions/${id}`),
  activateTrial: () => api.post<{ subscription_id?: string; id?: string }>('/user/user/trial'),
  updateAutoRenewal: (subscriptionId: number, autoRenewal: boolean) =>
    api.post(`/subscription/subscriptions/${subscriptionId}/auto-renewal?auto_renewal=${autoRenewal}`),
  getImportLinks: (subscriptionId: number) =>
    api.get<ImportLinksMap>(`/subscription/subscriptions/${subscriptionId}/import-links`),
  rename: (subscriptionId: number, customName: string) =>
    api.patch(`/subscription/subscriptions/${subscriptionId}/rename`, { custom_name: customName }),
};

export const paymentApi = {
  create: (data: object, userId?: number) => {
    const q = userId ? `?user_id=${userId}` : '';
    return api.post<{ payment?: { id: string; status: string }; confirmation_url?: string; url?: string }>(`/payments${q}`, data);
  },
  createSubscription: (data: { service_id: number }, userId: number) =>
    api.post<{ confirmation_url?: string; url?: string }>(`/subscription/subscriptions/payment?user_id=${userId}`, data),
  createRenewal: (data: { subscription_id: number; service_id: number }, userId: number) =>
    api.post<{ confirmation_url?: string; url?: string }>(`/subscription/subscriptions/renewal/payment?user_id=${userId}`, data),
  get: (id: string) => api.get(`/payments/${id}`),
  list: (userId: number, params?: { limit?: number; offset?: number }) =>
    api.get<{ payments?: unknown[] }>(`/payments/user/${userId}/history`, { limit: 50, offset: 0, ...params }),
  getPending: (userId: number) =>
    api.get<{ payments?: unknown[] }>(`/payments/user/${userId}/pending`).then(r => (r.payments ?? []) as PendingPaymentApiItem[]),
};

export type PendingPaymentApiItem = {
  id?: string;
  /** Actual payment ID from the backend (number) */
  payment_id?: number;
  /** 'renewal' | 'subscription' | 'gift' */
  payment_type?: string;
  status?: string;
  created_at?: string;
  confirmation_url?: string;
  payment_url?: string;
  url?: string;
  receipt_link?: string;
  service_id?: number;
  subscription_id?: number;
  gift_id?: number | null;
  service_name?: string;
  service_duration?: string;
  price?: number;
  amount?: number;
  currency?: string;
  description?: string;
};

export type UserKeyItem = {
  server_id: number;
  server_name: string;
  port: number;
  key: string;
};

export type UserKeyUnavailableItem = {
  server_id: number;
  server_name: string;
  port: number;
  message: string;
};

export type UserKeysResponse = {
  keys?: UserKeyItem[];
  unavailable?: UserKeyUnavailableItem[];
};

export const keysApi = {
  getUserKeys: (userId: number | string, subscriptionId: string | number) =>
    api.get<UserKeysResponse>('/keys/user-keys', { user_id: userId, subscription_id: subscriptionId }),
  getKeys: (subscriptionId: string) =>
    api.get<{ keys?: unknown[] }>('/keys', { subscription_id: subscriptionId }),
};

export const referralApi = {
  list: () => api.get<{ referrals?: unknown[] } | unknown[]>('/user/referral/me'),
};

export const servicesApi = {
  list: () => api.get<{ services?: unknown[] } | unknown[]>('/subscription/services'),
  get: (id: number) => api.get(`/services/${id}`),
};

export const giftApi = {
  create: (data: { service_id: number; recipient_user_id?: number; message?: string; sender_display_name?: string }) =>
    api.post('/subscription/gifts', data),
  get: (id: number) => api.get(`/subscription/gifts/${id}`),
  getByCode: (code: string) => api.get(`/subscription/gifts/code/${code}`),
  getPending: (userId: number) =>
    api.get<unknown[] | { gifts?: unknown[] }>(`/subscription/gifts/user/${userId}/pending`).then(r =>
      Array.isArray(r) ? r : (r as { gifts?: unknown[] }).gifts ?? []),
  getSent: (userId: number) =>
    api.get<unknown[] | { gifts?: unknown[] }>(`/subscription/gifts/user/${userId}/sent`).then(r =>
      Array.isArray(r) ? r : (r as { gifts?: unknown[] })?.gifts ?? []),
  activate: (id: number) => api.post(`/subscription/gifts/${id}/activate`),
  activateByCode: (code: string) => api.post('/subscription/gifts/activate/code', { gift_code: code }),
  refund: (id: number) => api.post(`/subscription/gifts/${id}/refund`),
};

export type ServerOnlineItem = {
  server_id: number;
  server_name: string;
  online: number;
};

export const serversApi = {
  list: () => api.get<{ servers?: ServerOnlineItem[] }>('/keys/servers/online'),
};

export type StoryItem = {
  id: number;
  title: string;
  description: string | null;
  content_type: 'image' | 'video';
  media_url: string;
  thumbnail_url: string | null;
  priority: number;
  expires_at: string | null;
  created_at: string;
  is_viewed?: boolean;
};

export const storiesApi = {
  checkUnviewed: () =>
    api.get<{ has_unviewed: boolean; count: number }>('/user/stories/unviewed/check'),
  getFeed: () =>
    api.get<StoryItem[]>('/user/stories/feed'),
  getUnviewed: () =>
    api.get<StoryItem[]>('/user/stories/unviewed'),
  markViewed: (storyId: number) =>
    api.post<void>('/user/stories/view', { story_id: storyId }),
};

export const currencyApi = {
  getBalance: () => api.get<{ balance?: number }>('/user/currency/balance'),
  getTransactions: (params?: { limit?: number; offset?: number }) =>
    api.get<{ transactions?: unknown[] }>('/user/currency/transactions', { limit: 50, offset: 0, ...params }),
  getDailyBonusStatus: () => api.get('/user/currency/daily-bonus/status'),
  claimDailyBonus: () => api.post<{ balance?: number; bonus_amount?: number }>('/user/currency/daily-bonus/claim'),
  getDailyBonusList: () => api.get('/user/currency/daily-bonus/list'),
};
