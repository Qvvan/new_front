import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useTelegram } from '../../core/telegram/hooks';
import { currencyApi } from '../../core/api/endpoints';
import type { ScreenName } from '../../app/routes';

const TABS: { screen: ScreenName; icon: string; label: string }[] = [
  { screen: 'subscription', icon: 'fas fa-shield-alt', label: 'Главная' },
  { screen: 'keys', icon: 'fas fa-key', label: 'Ключи' },
  { screen: 'referrals', icon: 'fas fa-users', label: 'Рефералы' },
];

export function BottomNav({ currentScreen, onNavigate }: { currentScreen: ScreenName; onNavigate: (s: ScreenName) => void }) {
  const tg = useTelegram();

  const { data: dailyBonus } = useQuery({
    queryKey: ['dailyBonus'],
    queryFn: () => currencyApi.getDailyBonusStatus(),
    staleTime: 60_000,
  });
  const canClaimBonus = (dailyBonus as { can_claim?: boolean })?.can_claim === true;

  const handleClick = useCallback((screen: ScreenName) => {
    tg?.haptic.selection();
    onNavigate(screen);
  }, [onNavigate, tg]);

  return (
    <div className="nexus-nav" id="bottomNav">
      <div className="nexus-nav-pill">
        {TABS.map(({ screen, icon, label }) => {
          const isActive = currentScreen === screen;
          const showDot = screen === 'subscription' && canClaimBonus && !isActive;
          return (
            <motion.button
              key={screen}
              type="button"
              className={`nexus-tab${isActive ? ' active' : ''}`}
              onClick={() => handleClick(screen)}
              data-screen={screen}
              whileTap={{ scale: 0.91 }}
              transition={{ duration: 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {isActive && (
                <motion.div
                  className="nexus-tab-indicator"
                  layoutId="nexus-nav-indicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <i className={`${icon} nexus-tab-icon`} />
                {showDot && <span className="nexus-nav-dot" />}
              </span>
              <span className="nexus-tab-label">{label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
