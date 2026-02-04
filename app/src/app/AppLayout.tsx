import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingOverlay } from '../shared/ui/LoadingOverlay';
import { PaymentBanner } from '../shared/ui/PaymentBanner';
import { BottomNav } from '../shared/ui/BottomNav';
import { ToastContainer } from '../shared/ui/Toast';
import { SubscriptionScreen } from '../features/subscription/SubscriptionScreen';
import { KeysScreen } from '../features/keys/KeysScreen';
import { ReferralsScreen } from '../features/referrals/ReferralsScreen';
import { PaymentsScreen } from '../features/payments/PaymentsScreen';
import { InstructionsModal } from '../features/instructions/InstructionsModal';
import { SupportModal } from '../features/support/SupportModal';
import { parseDeepLink, type ScreenName } from './routes';
import { usePendingPayments } from '../hooks/usePendingPayments';
import { pageTransition } from '../shared/motion/variants';

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
  const [screen, setScreen] = useState<ScreenName>(defaultScreen ?? 'subscription');
  const [loading, setLoading] = useState(true);
  const [, setSearchParams] = useSearchParams();
  usePendingPayments();

  useEffect(() => {
    const deep = parseDeepLink(window.location.search, window.location.hash);
    if (deep) {
      setScreen(deep.screen);
      if (Object.keys(deep.params).length) {
        (window as unknown as { __deepLinkParams?: Record<string, string> }).__deepLinkParams = deep.params;
      }
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 150);
    return () => clearTimeout(t);
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
            {screen === 'payments' && (
              <motion.div key="pay" {...pageTransition} style={{ height: '100%' }}>
                <PaymentsScreen />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        <BottomNav currentScreen={screen} onNavigate={navigate} />
        <ToastContainer />
        <InstructionsModal />
        <SupportModal />
      </div>
    </NavContext.Provider>
  );
}
