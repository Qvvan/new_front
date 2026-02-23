import { useState, useCallback, useEffect, createContext, useContext, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingOverlay } from '../shared/ui/LoadingOverlay';
import { PaymentBanner } from '../shared/ui/PaymentBanner';
import { BottomNav } from '../shared/ui/BottomNav';
import { ToastContainer } from '../shared/ui/Toast';
import { SubscriptionScreen } from '../features/subscription/SubscriptionScreen';
import { KeysScreen } from '../features/keys/KeysScreen';
import { ReferralsScreen } from '../features/referrals/ReferralsScreen';
import { CurrencyModal } from '../features/subscription/CurrencyModal';
import { DailyBonusModal } from '../features/subscription/DailyBonusModal';
import { HistoryModal } from '../shared/ui/HistoryModal';
import { InstructionsModal } from '../features/instructions/InstructionsModal';
import { SupportModal } from '../features/support/SupportModal';
import { StoriesViewer } from '../features/stories/StoriesViewer';
import { useStoriesStore } from '../features/stories/storiesStore';
import { storiesApi } from '../core/api/endpoints';
import { parseDeepLink, type ScreenName } from './routes';
import { useModalsStore } from './modalsStore';
import { usePendingPayments } from '../hooks/usePendingPayments';
import { usePaymentPolling } from '../hooks/usePaymentPolling';
import { PaymentSuccessOverlay } from '../shared/ui/PaymentSuccessOverlay';
import { pageTransition } from '../shared/motion/variants';
import {
  extractStartParam,
  parseStartParam,
  getScreenForAction,
  isReferralParam,
  useDeepLinkStore,
} from '../core/deeplink';

export const NavContext = createContext<{
  screen: ScreenName;
  navigate: (to: ScreenName, push?: boolean) => void;
  updateUrl: (s: ScreenName, params?: Record<string, string>) => void;
} | null>(null);

export function useAppNavigate() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useAppNavigate outside AppLayout');
  return ctx;
}

export function AppLayout({ defaultScreen }: { defaultScreen?: ScreenName }) {
  const [screen, setScreen] = useState<ScreenName>(
    defaultScreen === 'payments' ? 'subscription' : (defaultScreen ?? 'subscription')
  );
  const [loading, setLoading] = useState(true);
  const [, setSearchParams] = useSearchParams();
  usePendingPayments();
  const { successPayment, dismissSuccess } = usePaymentPolling();

  const {
    openInstructions,
    openSupport,
    dailyBonusOpen,
    closeDailyBonus,
    currencyOpen,
    closeCurrency,
    historyOpen,
    openHistory,
    closeHistory,
  } = useModalsStore();

  /* ── Deep link dispatch on mount ──────────────────────────── */
  useEffect(() => {
    // 1. New system: Telegram start_param
    const raw = extractStartParam();
    if (raw && !isReferralParam(raw)) {
      const action = parseStartParam(raw);
      if (action) {
        const target = getScreenForAction(action);
        if (target === 'payments') {
          setScreen('subscription');
          useModalsStore.getState().openHistory();
        } else {
          setScreen(target);
        }

        // Actions handled at layout level (global modals)
        if (action.type === 'instructions') {
          openInstructions();
        } else if (action.type === 'support') {
          openSupport();
        } else if (action.type === 'news') {
          const tg = window.Telegram?.WebApp;
          if (tg?.openTelegramLink) {
            tg.openTelegramLink('https://t.me/skydragonvpn');
          } else {
            window.open('https://t.me/skydragonvpn', '_blank');
          }
        } else if (action.type !== 'navigate') {
          // Screen-level actions (activate-code, services, gift, daily-bonus)
          // → store for SubscriptionScreen to consume
          useDeepLinkStore.getState().setPending(action);
        }
        return;
      }
    }

    // 2. Fallback: legacy URL query/hash deep links
    const deep = parseDeepLink(window.location.search, window.location.hash);
    if (deep) {
      if (deep.screen === 'payments') {
        setScreen('subscription');
        useModalsStore.getState().openHistory();
      } else {
        setScreen(deep.screen);
      }

      // Convert legacy params to new deep link actions
      const a = deep.params.action;
      if (a === 'activate-code') {
        useDeepLinkStore.getState().setPending({
          type: 'activate-code',
          ...(deep.params.code ? { code: deep.params.code } : {}),
        });
      } else if (a === 'services') {
        const mode = deep.params.mode as 'buy' | 'renew' | 'gift' | undefined;
        useDeepLinkStore.getState().setPending({
          type: 'services',
          mode: mode ?? 'buy',
        });
      } else if (a === 'gift') {
        useDeepLinkStore.getState().setPending({ type: 'gift' });
      } else if (a === 'daily-bonus') {
        useDeepLinkStore.getState().setPending({ type: 'daily-bonus' });
      } else if (a === 'news') {
        const tg = window.Telegram?.WebApp;
        if (tg?.openTelegramLink) {
          tg.openTelegramLink('https://t.me/skydragonvpn');
        } else {
          window.open('https://t.me/skydragonvpn', '_blank');
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 150);
    return () => clearTimeout(t);
  }, []);

  /* When deep link or URL asks for payments screen, open history modal instead */
  useEffect(() => {
    if (defaultScreen === 'payments') {
      setScreen('subscription');
      useModalsStore.getState().openHistory();
    }
  }, [defaultScreen]);

  /* ── Auto-show stories on first launch ─────────────────────── */
  const storiesChecked = useRef(false);
  useEffect(() => {
    if (storiesChecked.current) return;
    storiesChecked.current = true;

    (async () => {
      try {
        const check = await storiesApi.checkUnviewed();
        if (!check?.has_unviewed) return;
        useStoriesStore.getState().setHasUnviewed(true, check.count);

        const feed = await storiesApi.getFeed();
        if (!feed || feed.length === 0) return;
        useStoriesStore.getState().setStories(feed);

        // Open at first unviewed story (reordered: viewed left, unviewed right)
        const reordered = useStoriesStore.getState().stories;
        const firstUnviewed = reordered.findIndex((s) => !s.is_viewed);
        if (firstUnviewed >= 0) {
          // Small delay so the app renders first
          setTimeout(() => {
            useStoriesStore.getState().open(firstUnviewed);
          }, 400);
        }
      } catch {
        // Silent — don't break the app if stories endpoint fails
      }
    })();
  }, []);

  const navigate = useCallback((to: ScreenName, pushState = true) => {
    setScreen(to);
    if (pushState) setSearchParams({ screen: to }, { replace: false });
  }, [setSearchParams]);

  const updateUrl = useCallback((s: ScreenName, params?: Record<string, string>) => {
    const p = new URLSearchParams();
    p.set('screen', s);
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v != null && v !== '') p.set(k, v); });
    setSearchParams(p, { replace: true });
  }, [setSearchParams]);

  const ctx = { screen, navigate, updateUrl };

  if (loading) return <LoadingOverlay />;

  return (
    <NavContext.Provider value={ctx}>
      <div className="app-container">
        <div className="background-glow" aria-hidden />
        <PaymentBanner />
        <main className="main-content" id="mainContent">
          <AnimatePresence mode="wait">
            {screen === 'subscription' && (
              <motion.div key="sub" {...pageTransition} style={{ height: '100%' }}>
                <SubscriptionScreen />
              </motion.div>
            )}
            {screen === 'keys' && (
              <motion.div key="keys" {...pageTransition} style={{ height: '100%' }}>
                <KeysScreen />
              </motion.div>
            )}
            {screen === 'referrals' && (
              <motion.div key="ref" {...pageTransition} style={{ height: '100%' }}>
                <ReferralsScreen />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        <BottomNav currentScreen={screen} onNavigate={navigate} />
        <ToastContainer />
        <CurrencyModal open={currencyOpen} onClose={closeCurrency} />
        <DailyBonusModal open={dailyBonusOpen} onClose={closeDailyBonus} />
        <HistoryModal open={historyOpen} onClose={closeHistory} />
        <InstructionsModal />
        <SupportModal />
        <PaymentSuccessOverlay payment={successPayment} onDismiss={dismissSuccess} />
        <StoriesViewer />
      </div>
    </NavContext.Provider>
  );
}
