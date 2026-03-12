import { useCallback } from 'react';
import type React from 'react';
import { motion } from 'framer-motion';
import { useTelegram } from '../../core/telegram/hooks';
import type { ScreenName } from '../../app/routes';
import { navItemTap } from '../../shared/motion/variants';

function IconSubscription({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      {active && <path d="M9 12l2 2 4-4" strokeWidth="2" />}
    </svg>
  );
}

function IconKeys({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2L13 10" />
      <path d="M19 4l2 2" />
      <path d="M16 7l2 2" />
    </svg>
  );
}

function IconReferrals({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const TABS: { screen: ScreenName; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { screen: 'subscription', label: 'Подписка', Icon: IconSubscription },
  { screen: 'keys', label: 'Ключи', Icon: IconKeys },
  { screen: 'referrals', label: 'Рефералы', Icon: IconReferrals },
];

export function BottomNav({ currentScreen, onNavigate }: { currentScreen: ScreenName; onNavigate: (s: ScreenName) => void }) {
  const tg = useTelegram();

  const handleClick = useCallback((screen: ScreenName) => {
    tg?.haptic.selection();
    onNavigate(screen);
  }, [onNavigate, tg]);

  return (
    <div className="bottom-nav" id="bottomNav">
      <div className="nav-grid">
        {TABS.map(({ screen, label, Icon }) => {
          const active = currentScreen === screen;
          return (
            <motion.button
              key={screen}
              type="button"
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => handleClick(screen)}
              data-screen={screen}
              whileTap={navItemTap.tap}
              transition={navItemTap.transition}
            >
              <span className="nav-icon">
                <Icon active={active} />
              </span>
              <span className="nav-label">{label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
