import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setReferrerIdProvider } from '../api/client';

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramUser; start_param?: string };
  ready: () => void;
  expand: () => void;
  close: () => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  showAlert: (message: string) => void;
  showConfirm: (message: string, callback: (ok: boolean) => void) => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  enableClosingConfirmation: () => void;
  viewportHeight: number;
  HapticFeedback?: { impactOccurred: (t: string) => void; notificationOccurred: (t: string) => void; selectionChanged: () => void };
  onEvent: (event: string, handler: (data?: unknown) => void) => void;
  MainButton: { show: () => void; hide: () => void; setText: (t: string) => void; onClick: (cb: () => void) => void };
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void };
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface TelegramContextValue {
  webApp: TelegramWebApp | null;
  user: TelegramUser | null;
  initData: string;
  isReady: boolean;
  haptic: { light: () => void; success: () => void; selection: () => void };
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  showAlert: (message: string) => Promise<void>;
  showConfirm: (message: string) => Promise<boolean>;
  close: () => void;
  getReferrerId: () => string | null;
}

const fallbackUser: TelegramUser = {
  id: 123456789,
  first_name: 'Test',
  last_name: 'User',
  username: 'testuser',
  language_code: 'ru',
};

export const TelegramContext = createContext<TelegramContextValue | null>(null);

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initData, setInitData] = useState('');
  const [isReady, setIsReady] = useState(false);
  const refInitData = useRef<string>('');

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) {
      setUser(fallbackUser);
      setIsReady(true);
      return;
    }
    setWebApp(tg);
    setUser(tg.initDataUnsafe?.user ?? fallbackUser);
    const data = tg.initData || '';
    setInitData(data);
    refInitData.current = data;
    (window as unknown as { __tgInitData?: string }).__tgInitData = data;

    tg.ready();
    tg.expand();
    tg.setHeaderColor('#0d0d0d');
    tg.setBackgroundColor('#0d0d0d');
    tg.enableClosingConfirmation?.();

    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    if (tg.viewportHeight) {
      document.documentElement.style.setProperty('--tg-viewport-height', `${tg.viewportHeight}px`);
    }
    tg.onEvent?.('viewportChanged', () => {
      document.documentElement.style.setProperty('--tg-viewport-height', `${tg.viewportHeight}px`);
    });

    setIsReady(true);
  }, []);

  const haptic = useMemo(() => ({
    light: () => {
      try {
        webApp?.HapticFeedback?.impactOccurred('light') ?? navigator.vibrate?.(50);
      } catch {}
    },
    success: () => {
      try {
        webApp?.HapticFeedback?.notificationOccurred('success') ?? navigator.vibrate?.([100, 50, 100]);
      } catch {}
    },
    selection: () => {
      try {
        webApp?.HapticFeedback?.selectionChanged() ?? navigator.vibrate?.(30);
      } catch {}
    },
  }), [webApp]);

  const openLink = useCallback((url: string) => {
    webApp?.openLink?.(url) ?? window.open(url, '_blank');
  }, [webApp]);

  const openTelegramLink = useCallback((url: string) => {
    webApp?.openTelegramLink?.(url) ?? window.open(url, '_blank');
  }, [webApp]);

  const showAlert = useCallback((message: string) => {
    return new Promise<void>(resolve => {
      if (webApp?.showAlert) {
        webApp.showAlert(message);
        resolve();
      } else {
        alert(message);
        resolve();
      }
    });
  }, [webApp]);

  const showConfirm = useCallback((message: string) => {
    return new Promise<boolean>(resolve => {
      if (webApp?.showConfirm) {
        webApp.showConfirm(message, resolve);
      } else {
        resolve(confirm(message));
      }
    });
  }, [webApp]);

  const close = useCallback(() => {
    webApp?.close?.() ?? (window.history.length > 1 ? window.history.back() : window.close());
  }, [webApp]);

  const getReferrerId = useCallback(() => {
    const start = webApp?.initDataUnsafe?.start_param;
    if (start?.startsWith('ref_')) return start.slice(4);
    if (start && /^\d+$/.test(start)) return start;
    const params = new URLSearchParams(window.location.search);
    const startApp = params.get('startapp') ?? params.get('start');
    if (startApp?.startsWith('ref_')) return startApp.slice(4);
    if (startApp && /^\d+$/.test(startApp)) return startApp;
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const hashStart = hashParams.get('startapp') ?? hashParams.get('start');
      if (hashStart?.startsWith('ref_')) return hashStart.slice(4);
      if (hashStart && /^\d+$/.test(hashStart)) return hashStart;
    }
    return null;
  }, [webApp]);

  useEffect(() => {
    setReferrerIdProvider(getReferrerId);
    return () => setReferrerIdProvider(null);
  }, [getReferrerId]);

  const value = useMemo<TelegramContextValue>(() => ({
    webApp,
    user,
    initData,
    isReady,
    haptic,
    openLink,
    openTelegramLink,
    showAlert,
    showConfirm,
    close,
    getReferrerId,
  }), [webApp, user, initData, isReady, haptic, openLink, openTelegramLink, showAlert, showConfirm, close, getReferrerId]);

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
}
