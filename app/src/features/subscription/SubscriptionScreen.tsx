import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const SUBSCRIPTION_COMPACT_BREAKPOINT = 576;

function useIsSmallScreen(maxWidth: number = SUBSCRIPTION_COMPACT_BREAKPOINT) {
  const [isSmall, setIsSmall] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${maxWidth}px)`).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const handler = () => setIsSmall(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [maxWidth]);
  return isSmall;
}
import { useQuery, useMutation } from '@tanstack/react-query';
import { userApi, subscriptionApi, currencyApi, servicesApi, storiesApi } from '../../core/api/endpoints';
import { clearApiCache } from '../../core/api/client';
import { useModalsStore } from '../../app/modalsStore';
import { useToast } from '../../shared/ui/Toast';
import { useModal } from '../../shared/ui/Modal';
import { useTelegram } from '../../core/telegram/hooks';
import { useDeepLinkStore } from '../../core/deeplink';
import { daysBetween, pluralize, formatDate } from '../../core/utils';
import { staggerContainer, staggerItem } from '../../shared/motion/variants';
import { TgsPlayer, ASSETS_GIFS } from '../../shared/ui/TgsPlayer';
import { useStoriesStore } from '../stories/storiesStore';
import { ServiceSelectorModal } from './ServiceSelectorModal';
import { GiftFlowModal } from './GiftFlowModal';
import { ActivateCodeModal } from './ActivateCodeModal';
import '../stories/stories.css';
import { useAppNavigate } from '../../app/AppLayout';

type Sub = {
  subscription_id?: number;
  id?: string;
  end_date?: string;
  status?: string;
  auto_renewal?: boolean;
  service_name?: string;
  service_id?: number;
  custom_name?: string;
  source?: string;
};

type ServiceItem = { id?: number; service_id?: number; name?: string };

function isTrialSubscription(sub: Sub) {
  return sub.status === 'trial';
}

function RenameModal({ open, currentName, onSave, onClose, saving }: {
  open: boolean;
  currentName: string;
  onSave: (name: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(currentName);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, currentName]);

  if (!open) return null;

  const examples = ['Для мамы', 'Моя', 'Рабочая', 'Для папы', 'Основная'];

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal rename-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Переименовать подписку</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть"><i className="fas fa-times" /></button>
        </div>
        <div className="modal-body">
          <p className="rename-description">Придумайте удобное название для вашей подписки, чтобы легко её различать</p>
          <input
            ref={inputRef}
            className="rename-input"
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Введите название"
            maxLength={50}
            onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onSave(value.trim()); }}
          />
          <div className="rename-examples">
            <span className="rename-examples-label">Примеры:</span>
            <div className="rename-examples-list">
              {examples.map(ex => (
                <button key={ex} type="button" className="rename-example-chip" onClick={() => setValue(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(value.trim())} disabled={!value.trim() || saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StoriesButton() {
  const { hasUnviewed, unviewedCount, stories, open, setStories, setHasUnviewed } = useStoriesStore();
  const tg = useTelegram();

  const handleClick = useCallback(async () => {
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

  if (stories.length === 0) return null;

  const previewStory = stories.find((s) => !s.is_viewed) ?? stories[0];
  const previewUrl = previewStory ? (previewStory.thumbnail_url || previewStory.media_url) : null;

  return (
    <button
      type="button"
      className={`nexus-stories-btn${hasUnviewed ? ' has-unviewed' : ''}`}
      onClick={handleClick}
      aria-label="Stories"
    >
      <div className="nexus-stories-ring" />
      <div className="nexus-stories-inner">
        {previewUrl ? (
          <img src={previewUrl} alt="" draggable={false} />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" style={{ color: 'rgba(255,255,255,0.7)' }} />
          </svg>
        )}
      </div>
      {hasUnviewed && unviewedCount > 0 && (
        <span className="stories-unviewed-badge">{unviewedCount}</span>
      )}
    </button>
  );
}

/** Circular arc hero showing days remaining */
function SubHeroOrb({ days, isActive, isExpired }: { days: number; isActive: boolean; isExpired: boolean }) {
  const R = 58;
  const circumference = 2 * Math.PI * R;
  const arcProgress = isExpired ? 0 : Math.min(1, Math.max(0, days / 30));
  const strokeDashoffset = circumference * (1 - arcProgress);
  const orbClass = isExpired ? 'nexus-orb--expired' : isActive ? 'nexus-orb--active' : 'nexus-orb--inactive';
  const arcClass = isExpired ? 'nexus-orb-arc--expired' : isActive ? 'nexus-orb-arc--active' : 'nexus-orb-arc--inactive';
  const strokeColor = isExpired ? '#ef4444' : isActive ? 'url(#nx-arc-grad)' : '#a855f7';

  return (
    <div className="nexus-orb-wrap">
      <svg className="nexus-orb-svg" viewBox="0 0 144 144" width={144} height={144}>
        <defs>
          <linearGradient id="nx-arc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d4ff" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        {/* Background track */}
        <circle cx="72" cy="72" r={R} className="nexus-orb-track" />
        {/* Progress arc */}
        <circle
          cx="72" cy="72" r={R}
          className={`nexus-orb-arc ${arcClass}`}
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transformOrigin: '72px 72px', transform: 'rotate(-90deg)' }}
        />
      </svg>
      <div className={`nexus-orb ${orbClass}`}>
        <i className="fas fa-shield-alt nexus-orb-icon" />
      </div>
    </div>
  );
}

export function SubscriptionScreen() {
  const { navigate } = useAppNavigate();
  const toast = useToast();
  const modal = useModal();
  const tg = useTelegram();

  const [serviceSelector, setServiceSelector] = useState<{ open: boolean; mode: 'buy' | 'renew' | 'gift'; subscriptionId?: number }>({ open: false, mode: 'buy' });
  const [giftFlowOpen, setGiftFlowOpen] = useState(false);
  const [activateCodeOpen, setActivateCodeOpen] = useState(false);
  const [activateCodeInitial, setActivateCodeInitial] = useState<string | undefined>();
  const [renameModal, setRenameModal] = useState<{ open: boolean; subId: number; currentName: string }>({ open: false, subId: 0, currentName: '' });
  const [renameSaving, setRenameSaving] = useState(false);
  const { openInstructions, openSupport, openDailyBonus, openCurrency, openHistory, serviceSelector: storeServiceSelector, closeServiceSelector } = useModalsStore();

  /* ── Consume pending deep link action ─────────────────────── */
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current) return;
    const timer = setTimeout(() => {
      const action = useDeepLinkStore.getState().consume();
      if (!action) return;
      deepLinkConsumed.current = true;

      switch (action.type) {
        case 'activate-code':
          if (action.code) setActivateCodeInitial(action.code);
          setActivateCodeOpen(true);
          break;
        case 'services':
          setServiceSelector({ open: true, mode: action.mode ?? 'buy' });
          break;
        case 'gift':
          setGiftFlowOpen(true);
          break;
        case 'daily-bonus':
          openDailyBonus();
          break;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [openDailyBonus]);

  const serviceSelectorOpen = serviceSelector.open || storeServiceSelector?.open === true;
  const serviceSelectorMode = storeServiceSelector?.open ? storeServiceSelector.mode : serviceSelector.mode;
  const serviceSelectorSubscriptionId = storeServiceSelector?.open ? storeServiceSelector.subscriptionId : serviceSelector.subscriptionId;
  const closeServiceSelectorModal = () => {
    setServiceSelector(s => ({ ...s, open: false }));
    closeServiceSelector();
  };

  const { data: userRes } = useQuery({ queryKey: ['user'], queryFn: () => userApi.getCurrentUser() });
  const user = (userRes as { user?: unknown })?.user ?? userRes;
  const trialActivated = (user as { trial_activated?: boolean })?.trial_activated === true;

  const { data: subsRes, refetch: refetchSubs } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionApi.list(),
  });
  const subscriptions = (Array.isArray(subsRes) ? subsRes : (subsRes as { subscriptions?: Sub[] })?.subscriptions ?? []) as Sub[];

  const { data: servicesRes } = useQuery({ queryKey: ['services'], queryFn: () => servicesApi.list() });
  const servicesList = Array.isArray(servicesRes) ? servicesRes : (servicesRes as { services?: ServiceItem[] })?.services ?? [];
  const serviceMap = new Map((servicesList as ServiceItem[]).map(s => [(s.service_id ?? s.id)!, s]));

  function getServiceTypeName(sub: Sub): string {
    if (sub.service_name) return sub.service_name;
    const serviceId = sub.service_id;
    if (serviceId != null) {
      const service = serviceMap.get(serviceId);
      if (service?.name) return service.name;
    }
    return `Подписка ${String(sub.subscription_id ?? sub.id ?? '').slice(0, 8)}`;
  }

  function getDisplayName(sub: Sub): string {
    return sub.custom_name || getServiceTypeName(sub);
  }

  const { data: dailyBonus } = useQuery({
    queryKey: ['dailyBonus'],
    queryFn: () => currencyApi.getDailyBonusStatus(),
  });
  const { data: currencyBalance } = useQuery({
    queryKey: ['currencyBalance'],
    queryFn: () => currencyApi.getBalance(),
  });
  const balance = (currencyBalance as { balance?: number })?.balance ?? 0;
  const canClaimBonus = (dailyBonus as { can_claim?: boolean })?.can_claim === true;

  const activateTrial = useMutation({
    mutationFn: () => subscriptionApi.activateTrial(),
    onSuccess: async () => {
      toast.success('Пробный период активирован');
      clearApiCache('/subscription/subscriptions/user');
      await refetchSubs();
      tg?.haptic.success();
    },
    onError: (err: Error & { data?: { comment?: string } }) => {
      toast.error(err.data?.comment ?? err.message ?? 'Ошибка активации');
    },
  });

  const handleBuy = () => { tg?.haptic.light(); setServiceSelector({ open: true, mode: 'buy' }); };
  const handleRenew = (subId: number) => { tg?.haptic.light(); setServiceSelector({ open: true, mode: 'renew', subscriptionId: subId }); };
  const handleGift = () => { tg?.haptic.light(); setGiftFlowOpen(true); };
  const handleActivateCode = () => { tg?.haptic.light(); setActivateCodeOpen(true); };
  const handleInstructions = () => { tg?.haptic.light(); openInstructions(); };
  const handleSupport = () => { tg?.haptic.light(); openSupport(); };
  const handleNewsChannel = () => {
    tg?.haptic.light();
    tg?.openLink?.('https://t.me/skydragonvpn') ?? window.open('https://t.me/skydragonvpn', '_blank');
  };

  const handleRename = (sub: Sub) => {
    tg?.haptic.light();
    setRenameModal({ open: true, subId: sub.subscription_id ?? Number(sub.id), currentName: getDisplayName(sub) });
  };

  const handleRenameSave = useCallback(async (newName: string) => {
    setRenameSaving(true);
    try {
      await subscriptionApi.rename(renameModal.subId, newName);
      clearApiCache('/subscription/subscriptions/user');
      await refetchSubs();
      toast.success('Подписка переименована');
      tg?.haptic.success();
      setRenameModal(m => ({ ...m, open: false }));
    } catch (err: unknown) {
      const e = err as Error & { data?: { comment?: string } };
      toast.error(e.data?.comment ?? e.message ?? 'Ошибка переименования');
    } finally {
      setRenameSaving(false);
    }
  }, [renameModal.subId, refetchSubs, toast, tg]);

  const handleTrial = useCallback(async () => {
    const ok = await modal.showConfirm(
      'Активировать пробный период?',
      'Бесплатно 5 дней. После окончания подписка автоматически не продлится.',
      { confirmText: 'Активировать' }
    );
    if (ok) activateTrial.mutate();
  }, [modal, activateTrial]);

  const handleAutoRenewalToggle = useCallback(async (subId: number, current: boolean) => {
    const ok = await modal.showConfirm(
      current ? 'Выключить автопродление?' : 'Включить автопродление?',
      current ? 'Подписка завершится в указанную дату.' : 'Подписка будет продлеваться автоматически за день до окончания.'
    );
    if (!ok) return;
    try {
      await subscriptionApi.updateAutoRenewal(subId, !current);
      clearApiCache('/subscription/subscriptions/user');
      await refetchSubs();
      toast.success(!current ? 'Автопродление включено' : 'Автопродление выключено');
      tg?.haptic.success();
    } catch (err: unknown) {
      const e = err as Error & { data?: { comment?: string } };
      toast.error(e.data?.comment ?? e.message ?? 'Ошибка');
    }
  }, [modal, refetchSubs, toast, tg]);

  // Computed state for UX-driven CTA
  const activeSubs = subscriptions.filter(s => {
    const days = daysBetween(s.end_date ?? '');
    return days > 0 && (s.status === 'active' || s.status === 'trial' || (s as { is_active?: boolean }).is_active);
  });
  const primarySub = activeSubs[0] ?? subscriptions[0];
  const hasActive = activeSubs.length > 0;
  const hasExpiredOnly = subscriptions.length > 0 && activeSubs.length === 0;
  const primaryDays = primarySub ? Math.abs(daysBetween(primarySub.end_date ?? '')) : 0;
  const primaryIsExpired = primarySub ? daysBetween(primarySub.end_date ?? '') <= 0 : false;
  const primaryId = primarySub ? (primarySub.subscription_id ?? Number(primarySub.id)) : 0;

  return (
    <div className="screen active" id="subscriptionScreen">
      <motion.div variants={staggerContainer} initial="initial" animate="animate">

        {/* ── Top Bar — Clean & Minimal ── */}
        <motion.div className="nexus-topbar" variants={staggerItem}>
          <div className="nexus-topbar-left">
            <div className="nexus-logo">
              <div className="nexus-logo-mark">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
                  <path d="M10 2L13.5 7H17L14 10.5L15.5 15L10 12L4.5 15L6 10.5L3 7H6.5L10 2Z" fill="white" />
                  <circle cx="10" cy="10" r="2.5" fill="rgba(255,255,255,0.3)" />
                </svg>
              </div>
              <div className="nexus-logo-text">
                <span className="nexus-logo-sky">Sky</span><span className="nexus-logo-dragon">Dragon</span>
              </div>
            </div>
          </div>
          <div className="nexus-topbar-right">
            <StoriesButton />
            {balance > 0 && (
              <button
                type="button"
                className="nexus-balance-chip"
                onClick={() => { tg?.haptic.light(); openCurrency(); }}
                data-action="show-currency-info-modal"
                aria-label="Баланс Dragon Coins"
              >
                <i className="fas fa-coins" />
                <span>{Number(balance).toFixed(0)}</span>
                <span className="nexus-balance-chip-code">DRG</span>
              </button>
            )}
            <button
              type="button"
              className="nexus-icon-btn"
              onClick={() => { tg?.haptic.light(); openHistory(); }}
              aria-label="История операций"
            >
              <i className="fas fa-bell" />
            </button>
          </div>
        </motion.div>

        {/* ── Hero Orb — always shown ── */}
        <motion.div variants={staggerItem}>
          <div className="nexus-hero">
            {subscriptions.length === 0 ? (
              <>
                <SubHeroOrb days={0} isActive={false} isExpired={false} />
                <div className="nexus-hero-days">
                  <span className="nexus-hero-days-count nexus-hero-days-count--inactive">—</span>
                  <span className="nexus-hero-days-label">нет подписки</span>
                </div>
              </>
            ) : (
              <>
                <SubHeroOrb days={primaryDays} isActive={hasActive} isExpired={primaryIsExpired} />
                <div className="nexus-hero-days">
                  <span className={`nexus-hero-days-count nexus-hero-days-count--${primaryIsExpired ? 'expired' : 'active'}`}>
                    {primaryDays}
                  </span>
                  <span className="nexus-hero-days-label">
                    {primaryIsExpired
                      ? 'дней назад истекла'
                      : pluralize(primaryDays, ['день остался', 'дня осталось', 'дней осталось'])}
                  </span>
                </div>
                <div className={`nexus-status-badge nexus-status-badge--${primaryIsExpired ? 'expired' : 'active'}`}>
                  {!primaryIsExpired && <span className="nexus-status-dot" />}
                  {primaryIsExpired ? 'Истекла' : 'Активна'}
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* ── Primary CTA — One button, state-driven ── */}
        <motion.div variants={staggerItem}>
          {hasActive && (
            <button
              type="button"
              className="nexus-cta-hero"
              onClick={() => { tg?.haptic.light(); navigate('keys'); }}
            >
              <i className="fas fa-key" />
              <span>Мои VPN ключи</span>
            </button>
          )}
          {hasExpiredOnly && (
            <button
              type="button"
              className="nexus-cta-hero nexus-cta-hero--warn"
              onClick={() => handleRenew(primaryId)}
            >
              <i className="fas fa-sync-alt" />
              <span>Продлить подписку</span>
            </button>
          )}
          {subscriptions.length === 0 && (
            <div className="nexus-cta-pair">
              {!trialActivated && (
                <button
                  type="button"
                  className="nexus-trial-btn"
                  onClick={handleTrial}
                  disabled={activateTrial.isPending}
                  data-action="activate-trial"
                >
                  <div className="nexus-trial-icon">
                    <TgsPlayer src={`${ASSETS_GIFS}/gift-animate.tgs`} fallbackIcon="fas fa-gift" width={40} height={40} />
                  </div>
                  <div className="nexus-trial-text">
                    <span className="nexus-trial-main">Пробный период</span>
                    <span className="nexus-trial-sub">5 дней бесплатно</span>
                  </div>
                  <div className="nexus-trial-arrow"><i className="fas fa-chevron-right" /></div>
                </button>
              )}
              <button
                type="button"
                className="nexus-cta-hero"
                onClick={handleBuy}
                data-action="buy"
                style={trialActivated ? {} : { marginTop: 10 }}
              >
                <i className="fas fa-plus" />
                <span>Купить подписку</span>
              </button>
            </div>
          )}
        </motion.div>

        {/* ── Quick Actions — 2×3 visible grid, no scroll ── */}
        <motion.div variants={staggerItem}>
          <div className="nexus-section-label">Быстрые действия</div>
          <div className="nexus-actions-grid">

            {/* Bonus — always visible, glows when claimable */}
            <button
              type="button"
              className={`nexus-action-card nexus-action-card--amber${canClaimBonus ? ' nexus-action-card--glow' : ''}`}
              onClick={() => { tg?.haptic.light(); openDailyBonus(); }}
              data-action="show-daily-bonus-modal"
            >
              <div className="nexus-action-card-icon">
                <TgsPlayer src={`${ASSETS_GIFS}/gift-animate.tgs`} fallbackIcon="fas fa-gift" width={28} height={28} />
              </div>
              <span className="nexus-action-card-label">
                {canClaimBonus ? 'Бонус 🔥' : 'Бонус'}
              </span>
              {canClaimBonus && <span className="nexus-action-card-badge">!</span>}
            </button>

            <button
              type="button"
              className="nexus-action-card nexus-action-card--blue"
              onClick={handleInstructions}
              data-action="instructions"
            >
              <div className="nexus-action-card-icon"><i className="fas fa-book-open" /></div>
              <span className="nexus-action-card-label">Инструкции</span>
            </button>

            <button
              type="button"
              className="nexus-action-card nexus-action-card--violet"
              onClick={handleSupport}
              data-action="support"
            >
              <div className="nexus-action-card-icon"><i className="fas fa-comment-dots" /></div>
              <span className="nexus-action-card-label">Поддержка</span>
            </button>

            <button
              type="button"
              className="nexus-action-card nexus-action-card--green"
              onClick={handleBuy}
              data-action="buy"
            >
              <div className="nexus-action-card-icon"><i className="fas fa-plus" /></div>
              <span className="nexus-action-card-label">Купить</span>
            </button>

            <button
              type="button"
              className="nexus-action-card nexus-action-card--pink"
              onClick={handleGift}
              data-action="gift"
            >
              <div className="nexus-action-card-icon"><i className="fas fa-gift" /></div>
              <span className="nexus-action-card-label">Подарить</span>
            </button>

            <button
              type="button"
              className="nexus-action-card nexus-action-card--cyan"
              onClick={handleActivateCode}
              data-action="activate-code"
            >
              <div className="nexus-action-card-icon"><i className="fas fa-key" /></div>
              <span className="nexus-action-card-label">Активировать</span>
            </button>

          </div>
        </motion.div>

        {/* ── Subscription Details — below fold ── */}
        {subscriptions.length === 1 && (() => {
          const sub = subscriptions[0];
          const subId = sub.subscription_id ?? Number(sub.id);
          const days = daysBetween(sub.end_date ?? '');
          const isExpired = days <= 0;
          const isTrial = isTrialSubscription(sub);
          const renewalDate = formatDate(sub.end_date ?? '', 'long');
          const autoRenewalText = sub.auto_renewal && !isExpired ? `Продление ${renewalDate}` : `Завершится ${renewalDate}`;
          return (
            <motion.div variants={staggerItem}>
              <div className={`nexus-sub-card nexus-sub-card--${isExpired ? 'expired' : 'active'}`} data-subscription-id={subId}>
                <div className="nexus-sub-name">
                  <i className={`fas ${isTrial ? 'fa-gift' : 'fa-shield-alt'}`}
                     style={{ color: isExpired ? 'var(--nx-red)' : 'var(--nx-cyan)', marginRight: 6 }} />
                  <h2>{getDisplayName(sub)}</h2>
                  <button
                    type="button"
                    className="nexus-rename-btn"
                    onClick={() => handleRename(sub)}
                    title="Переименовать"
                    aria-label="Переименовать подписку"
                  >
                    <i className="fas fa-pen" />
                  </button>
                </div>
                {sub.custom_name && <div className="nexus-sub-type-label">{getServiceTypeName(sub)}</div>}
                {!isExpired && !isTrial && (
                  <div
                    className="nexus-renewal"
                    data-subscription-id={subId}
                    onClick={() => handleAutoRenewalToggle(subId, !!sub.auto_renewal)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="nexus-renewal-info">
                      <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <TgsPlayer src={`${ASSETS_GIFS}/auto-renewal.tgs`} fallbackIcon="fas fa-sync-alt" width={28} height={28} />
                      </div>
                      <div className="nexus-renewal-text">
                        <h4>Автопродление</h4>
                        <p>{autoRenewalText}</p>
                      </div>
                    </div>
                    <div className={`nexus-toggle${sub.auto_renewal ? ' on' : ''}`}>
                      <div className="nexus-toggle-knob" />
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className="nexus-renew-btn"
                  onClick={() => handleRenew(subId)}
                  data-action="renew"
                  data-subscription-id={subId}
                >
                  <i className="fas fa-sync-alt" /> Продлить подписку
                </button>
              </div>
            </motion.div>
          );
        })()}

        {/* ── Multiple subscriptions compact list ── */}
        {subscriptions.length > 1 && (
          <motion.div variants={staggerItem}>
            <div className="nexus-section-label">Ваши подписки</div>
            <div className="nexus-subs-list">
              {subscriptions.map((sub) => {
                const subId = sub.subscription_id ?? Number(sub.id);
                const days = daysBetween(sub.end_date ?? '');
                const isExpired = days <= 0;
                const isTrial = isTrialSubscription(sub);
                return (
                  <div
                    key={subId}
                    className={`nexus-sub-compact${isExpired ? ' nexus-sub-compact--expired' : ''}`}
                    data-subscription-id={subId}
                  >
                    <div className="nexus-sub-compact-left">
                      <div className={`nexus-sub-compact-icon${isExpired ? ' nexus-sub-compact-icon--expired' : ''}`}>
                        <i className={`fas ${isTrial ? 'fa-gift' : 'fa-shield-alt'}`} />
                      </div>
                      <div className="nexus-sub-compact-details">
                        <div className="nexus-sub-compact-name">
                          {getDisplayName(sub)}
                          <button
                            type="button"
                            className="nexus-rename-btn-compact"
                            onClick={(e) => { e.stopPropagation(); handleRename(sub); }}
                            aria-label="Переименовать"
                          >
                            <i className="fas fa-pen" />
                          </button>
                        </div>
                        {sub.custom_name && <div className="nexus-sub-compact-type">{getServiceTypeName(sub)}</div>}
                      </div>
                    </div>
                    <div className="nexus-sub-compact-right">
                      {!isTrial && !isExpired && (
                        <div
                          className="nexus-compact-renewal"
                          onClick={() => handleAutoRenewalToggle(subId, !!sub.auto_renewal)}
                          role="button"
                          tabIndex={0}
                        >
                          <span className="nexus-compact-renewal-label">Авто</span>
                          <div className={`nexus-toggle-sm${sub.auto_renewal ? ' on' : ''}`}>
                            <div className="nexus-toggle-sm-knob" />
                          </div>
                        </div>
                      )}
                      <div className="nexus-sub-compact-days">
                        <div className={`nexus-sub-compact-days-count${isExpired ? ' nexus-sub-compact-days-count--expired' : ''}`}>
                          {Math.abs(days)}
                        </div>
                        <div className="nexus-sub-compact-days-label">
                          {isExpired ? 'дн. назад' : 'дн. осталось'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="nexus-renew-btn"
                        style={{ width: 'auto', padding: '8px 14px', marginTop: 0, fontSize: 12 }}
                        onClick={() => handleRenew(subId)}
                        data-action="renew"
                        data-subscription-id={subId}
                        title="Продлить"
                      >
                        <i className="fas fa-sync-alt" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

      </motion.div>

      <ServiceSelectorModal
        open={serviceSelectorOpen}
        mode={serviceSelectorMode}
        subscriptionId={serviceSelectorSubscriptionId}
        onClose={closeServiceSelectorModal}
        onSuccess={() => { refetchSubs(); closeServiceSelectorModal(); }}
      />
      <GiftFlowModal open={giftFlowOpen} onClose={() => setGiftFlowOpen(false)} onSuccess={() => { refetchSubs(); setGiftFlowOpen(false); }} />
      <ActivateCodeModal
        open={activateCodeOpen}
        initialCode={activateCodeInitial}
        onClose={() => { setActivateCodeOpen(false); setActivateCodeInitial(undefined); }}
        onSuccess={() => { refetchSubs(); setActivateCodeOpen(false); setActivateCodeInitial(undefined); }}
      />
      <RenameModal
        open={renameModal.open}
        currentName={renameModal.currentName}
        onSave={handleRenameSave}
        onClose={() => setRenameModal(m => ({ ...m, open: false }))}
        saving={renameSaving}
      />
    </div>
  );
}
