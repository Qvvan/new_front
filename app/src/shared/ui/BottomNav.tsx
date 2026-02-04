import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTelegram } from '../../core/telegram/hooks';
import { usePaymentBannerStore } from './PaymentBanner';
import type { ScreenName } from '../../app/routes';
import { navItemTap } from '../../shared/motion/variants';

const TABS: { screen: ScreenName; icon: string; label: string }[] = [
  { screen: 'subscription', icon: 'fas fa-shield-alt', label: 'Подписка' },
  { screen: 'keys', icon: 'fas fa-key', label: 'Ключи' },
  { screen: 'referrals', icon: 'fas fa-users', label: 'Рефералы' },
  { screen: 'payments', icon: 'fas fa-credit-card', label: 'Платежи' },
];

export function BottomNav({ currentScreen, onNavigate }: { currentScreen: ScreenName; onNavigate: (s: ScreenName) => void }) {
  const tg = useTelegram();
  const hasPendingPayment = usePaymentBannerStore(s => !!s.payment);

  const handleClick = useCallback((screen: ScreenName) => {
    tg?.haptic.selection();
    onNavigate(screen);
  }, [onNavigate, tg]);

  return (
    <div className="bottom-nav" id="bottomNav">
      <div className="nav-grid">
        {TABS.map(({ screen, icon, label }) => (
          <motion.button
            key={screen}
            type="button"
            className={`nav-item ${currentScreen === screen ? 'active' : ''}`}
            onClick={() => handleClick(screen)}
            data-screen={screen}
            whileTap={navItemTap.tap}
            transition={navItemTap.transition}
          >
            <i className={`${icon} nav-icon`} />
            <span className="nav-label">{label}</span>
            {screen === 'payments' && hasPendingPayment && (
              <motion.span
                className="nav-badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                1
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
