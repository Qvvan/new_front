import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTelegram } from '../../core/telegram/hooks';
import { currencyApi, storiesApi } from '../../core/api/endpoints';
import { usePaymentBannerStore } from './PaymentBanner';
import { useStoriesStore } from '../../features/stories/storiesStore';

export interface TopBarProps {
  onBalanceClick: () => void;
  onHistoryClick: () => void;
  onDailyBonusClick: () => void;
  onPendingPaymentClick?: () => void;
}

export function TopBar({
  onBalanceClick,
  onHistoryClick,
  onDailyBonusClick,
  onPendingPaymentClick,
}: TopBarProps) {
  const tg = useTelegram();
  const hasPendingPayment = usePaymentBannerStore((s) => !!s.payment);

  const { data: currencyBalance } = useQuery({
    queryKey: ['currencyBalance'],
    queryFn: () => currencyApi.getBalance(),
  });
  const balance = (currencyBalance as { balance?: number })?.balance ?? 0;

  const { data: dailyBonus } = useQuery({
    queryKey: ['dailyBonus'],
    queryFn: () => currencyApi.getDailyBonusStatus(),
  });
  const canClaimBonus = (dailyBonus as { can_claim?: boolean })?.can_claim === true;

  const { stories, hasUnviewed, unviewedCount, open, setStories, setHasUnviewed } = useStoriesStore();

  useEffect(() => {
    storiesApi.checkUnviewed().then((res) => {
      if (res) setHasUnviewed(res.has_unviewed, res.count);
    }).catch(() => {});
    if (stories.length === 0) {
      storiesApi.getFeed().then((feed) => {
        if (feed && feed.length > 0) setStories(feed);
      }).catch(() => {});
    }
  }, [setHasUnviewed, setStories, stories.length]);

  const handleStoriesClick = useCallback(async () => {
    tg?.haptic.light();
    try {
      const feed = await storiesApi.getFeed();
      if (feed && feed.length > 0) {
        setStories(feed);
        const reordered = useStoriesStore.getState().stories;
        const firstUnviewed = reordered.findIndex((s) => !s.is_viewed);
        open(firstUnviewed >= 0 ? firstUnviewed : 0);
      }
    } catch {
      // silent
    }
  }, [tg, setStories, open]);

  const showStoriesButton = stories.length > 0;
  const previewStory = stories.find((s) => !s.is_viewed) ?? stories[0];
  const previewUrl = previewStory ? (previewStory.thumbnail_url || previewStory.media_url) : null;

  return (
    <header className="app-top-bar" id="appTopBar">
      <div className="app-top-bar-left">
        <button
          type="button"
          className="daily-bonus-button"
          onClick={() => { tg?.haptic.light(); onDailyBonusClick(); }}
          data-action="show-daily-bonus-modal"
          aria-label="Ежедневный бонус"
        >
          <div className="daily-bonus-button-icon">
            <i className="fas fa-gift" />
            {canClaimBonus && <span className="bonus-claim-indicator" />}
          </div>
          <span className="daily-bonus-button-text">Бонус</span>
        </button>
        {showStoriesButton && (
          <button
            type="button"
            className={`stories-top-button${hasUnviewed ? ' has-unviewed' : ''}`}
            onClick={handleStoriesClick}
            aria-label="Stories"
          >
            <div className="stories-top-button-ring" />
            <div className="stories-top-button-inner">
              {previewUrl ? (
                <img className="stories-top-button-preview" src={previewUrl} alt="" draggable={false} />
              ) : (
                <div className="stories-top-button-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
                  </svg>
                </div>
              )}
            </div>
            {hasUnviewed && unviewedCount > 0 && (
              <span className="stories-unviewed-badge">{unviewedCount}</span>
            )}
          </button>
        )}
      </div>
      <div className="app-top-bar-right">
        <button
          type="button"
          className="currency-balance-button"
          onClick={() => { tg?.haptic.light(); onBalanceClick(); }}
          data-action="show-currency-info-modal"
          aria-label="Баланс Dragon Coins"
        >
          <div className="currency-balance-icon"><i className="fas fa-coins" /></div>
          <span className="currency-balance-amount">{Number(balance).toFixed(0)}</span>
          <span className="currency-balance-code">DRG</span>
        </button>
        <button
          type="button"
          className="top-bar-icon-btn"
          onClick={() => { tg?.haptic.light(); onHistoryClick(); }}
          aria-label="История операций"
        >
          <i className="fas fa-history" />
        </button>
        {hasPendingPayment && (
          <button
            type="button"
            className="top-bar-icon-btn top-bar-icon-btn--pending"
            onClick={() => { tg?.haptic.light(); onPendingPaymentClick?.(); }}
            aria-label="Ожидающий платёж"
          >
            <i className="fas fa-credit-card" />
            <span className="top-bar-pending-badge">1</span>
          </button>
        )}
      </div>
    </header>
  );
}
