const BASE = '/api/v1';

const requestCache = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL = 5000;

/** Set by TelegramProvider: returns referrer_id for POST /user/user when user opens app via referral link */
let referrerIdProvider: (() => string | null) | null = null;
export function setReferrerIdProvider(fn: (() => string | null) | null): void {
  referrerIdProvider = fn;
}

function cacheKey(endpoint: string, method: string, data: unknown): string {
  return `${method}:${endpoint}:${data ? JSON.stringify(data) : ''}`;
}

function getAuthHeaders(): Record<string, string> {
  const initData = (window as unknown as { __tgInitData?: string }).__tgInitData;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
  if (initData) headers['X-Telegram-Init-Data'] = initData;
  return headers;
}

async function handleErrorResponse(response: Response): Promise<never> {
  let message = 'Произошла ошибка';
  let data: { comment?: string; message?: string; error?: string } | null = null;
  try {
    data = await response.json();
    message = data?.comment ?? data?.message ?? data?.error ?? message;
  } catch {
    message = response.statusText || message;
  }
  switch (response.status) {
    case 400: message = data?.comment ?? data?.message ?? 'Неверные данные'; break;
    case 401: message = 'Необходима авторизация'; break;
    case 403: message = 'Доступ запрещен'; break;
    case 404: message = 'Ресурс не найден'; break;
    case 429: message = 'Слишком много запросов'; break;
    case 500: message = 'Внутренняя ошибка сервера'; break;
    case 503: message = 'Сервис временно недоступен'; break;
  }
  const err = new Error(message) as Error & { status?: number; data?: unknown };
  err.status = response.status;
  err.data = data;
  throw err;
}

export async function apiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  data?: unknown,
  options: { cacheable?: boolean } = {}
): Promise<T> {
  const url = `${BASE}${endpoint}`;
  let body: unknown = data;
  if (method === 'POST' && endpoint === '/user/user' && referrerIdProvider) {
    const refId = referrerIdProvider();
    body = refId ? { referrer_id: refId } : (data ?? {});
  }
  const key = cacheKey(endpoint, method, body);
  const isCacheable = method === 'GET' || (method === 'POST' && options.cacheable !== false);
  const shouldCache = method === 'GET' || options.cacheable === true;

  if (isCacheable && requestCache.has(key)) {
    return requestCache.get(key) as Promise<T>;
  }

  if (shouldCache) {
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data as T;
  }

  const config: RequestInit = {
    method,
    headers: getAuthHeaders(),
    cache: 'no-store',
  };
  if (body != null && ['POST', 'PUT', 'PATCH'].includes(method)) {
    config.body = JSON.stringify(body);
  }

  const promise = (async (): Promise<T> => {
    const response = await fetch(url, config);
    if (!response.ok) await handleErrorResponse(response);
    const result = (await response.json()) as T;
    // After a successful mutation (non-GET, non-cacheable POST), clear the response cache
    // so that subsequent React Query refetches get fresh data instead of stale cached responses
    if (method !== 'GET' && !shouldCache) {
      responseCache.clear();
    }
    if (shouldCache) {
      const ttl = method === 'POST' && endpoint === '/user/user' ? 30000 : CACHE_TTL;
      responseCache.set(key, { data: result, expiresAt: Date.now() + ttl });
    }
    return result;
  })();

  if (isCacheable) {
    requestCache.set(key, promise);
    promise.finally(() => requestCache.delete(key));
  }

  return promise;
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number | undefined>) => {
    let url = endpoint;
    if (params && Object.keys(params).length > 0) {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v != null) search.append(k, String(v));
      });
      url += `?${search.toString()}`;
    }
    return apiRequest<T>(url, 'GET');
  },
  post: <T>(endpoint: string, data?: object, opts?: { cacheable?: boolean }) =>
    apiRequest<T>(endpoint, 'POST', data, opts),
  put: <T>(endpoint: string, data?: object) => apiRequest<T>(endpoint, 'PUT', data),
  patch: <T>(endpoint: string, data?: object) => apiRequest<T>(endpoint, 'PATCH', data),
  delete: <T>(endpoint: string) => apiRequest<T>(endpoint, 'DELETE'),
};

export function clearApiCache(endpoint?: string): void {
  if (endpoint) {
    for (const key of requestCache.keys()) {
      if (key.includes(endpoint)) requestCache.delete(key);
    }
    for (const key of responseCache.keys()) {
      if (key.includes(endpoint)) responseCache.delete(key);
    }
  } else {
    requestCache.clear();
    responseCache.clear();
  }
}
