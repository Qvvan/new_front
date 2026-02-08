import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation } from '@tanstack/react-query';
import { userApi, subscriptionApi, currencyApi, servicesApi } from '../../core/api/endpoints';
import { clearApiCache } from '../../core/api/client';
import { useModalsStore } from '../../app/modalsStore';
import { useToast } from '../../shared/ui/Toast';
import { useModal } from '../../shared/ui/Modal';
import { useTelegram } from '../../core/telegram/hooks';
import { useDeepLinkStore } from '../../core/deeplink';
import { daysBetween, pluralize, formatDate } from '../../core/utils';
import { staggerContainer, staggerItem } from '../../shared/motion/variants';
import { TgsPlayer, ASSETS_GIFS } from '../../shared/ui/TgsPlayer';
import { ServiceSelectorModal } from './ServiceSelectorModal';
import { GiftFlowModal } from './GiftFlowModal';
import { ActivateCodeModal } from './ActivateCodeModal';
import { DailyBonusModal } from './DailyBonusModal';
import { CurrencyModal } from './CurrencyModal';

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
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">×</button>
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

export function SubscriptionScreen() {
  const toast = useToast();
  const modal = useModal();
  const tg = useTelegram();

  const [serviceSelector, setServiceSelector] = useState<{ open: boolean; mode: 'buy' | 'renew' | 'gift'; subscriptionId?: number }>({ open: false, mode: 'buy' });
  const [giftFlowOpen, setGiftFlowOpen] = useState(false);
  const [activateCodeOpen, setActivateCodeOpen] = useState(false);
  const [activateCodeInitial, setActivateCodeInitial] = useState<string | undefined>();
  const [dailyBonusModalOpen, setDailyBonusModalOpen] = useState(false);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [renameModal, setRenameModal] = useState<{ open: boolean; subId: number; currentName: string }>({ open: false, subId: 0, currentName: '' });
  const [renameSaving, setRenameSaving] = useState(false);
  const { openInstructions, openSupport, serviceSelector: storeServiceSelector, closeServiceSelector } = useModalsStore();

  /* ── Consume pending deep link action ─────────────────────── */
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current) return;
    // Small delay so component is fully mounted and modals are ready
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
          setDailyBonusModalOpen(true);
          break;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);
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
      'Бесплатно 5 дней. После окончания подписка автоматически не продлится.'
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

  return (
    <div className="screen active" id="subscriptionScreen">
      <motion.div className="content-wrapper" variants={staggerContainer} initial="initial" animate="animate">
        <motion.div className="subscription-top-bar" variants={staggerItem}>
          <button type="button" className="daily-bonus-button" onClick={() => setDailyBonusModalOpen(true)} data-action="show-daily-bonus-modal">
            <div className="daily-bonus-button-icon">
              <i className="fas fa-gift" />
              {canClaimBonus && <span className="bonus-claim-indicator blinking" />}
            </div>
            <span className="daily-bonus-button-text">Бонус</span>
          </button>
          <button type="button" className="currency-balance-button" onClick={() => setCurrencyModalOpen(true)} data-action="show-currency-info-modal">
            <div className="currency-balance-icon"><i className="fas fa-coins" /></div>
            <span className="currency-balance-amount">{Number(balance).toFixed(0)}</span>
            <span className="currency-balance-code">DRG</span>
          </button>
        </motion.div>

        {subscriptions.length === 0 ? (
          <motion.div className="empty-state-card" variants={staggerItem}>
            <div className="empty-state-content">
              {!trialActivated ? (
                <>
                  <div className="empty-state-icon-gif">
                    <TgsPlayer src={`${ASSETS_GIFS}/gift-animate.tgs`} fallbackIcon="fas fa-gift" width={80} height={80} />
                  </div>
                  <h3 className="empty-state-title">Нет активных подписок</h3>
                  <div className="empty-state-actions">
                    <button type="button" className="btn-trial-activation" onClick={handleTrial} disabled={activateTrial.isPending} data-action="activate-trial">
                      <div className="btn-trial-bg"><div className="btn-trial-shine" /><div className="btn-trial-glow" /></div>
                      <div className="btn-trial-content">
                        <div className="trial-icon-wrapper"><TgsPlayer src={`${ASSETS_GIFS}/gift-animate.tgs`} fallbackIcon="fas fa-gift" width={40} height={40} /></div>
                        <div className="trial-text">
                          <span className="trial-main">Пробный период</span>
                          <span className="trial-sub">5 дней бесплатно</span>
                        </div>
                        <div className="trial-arrow"><i className="fas fa-arrow-right" /></div>
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="empty-state-icon-gif">
                    <TgsPlayer src={`${ASSETS_GIFS}/empty-profiles.tgs`} fallbackIcon="fas fa-shield-alt" width={80} height={80} />
                  </div>
                  <h3 className="empty-state-title">Нет активных подписок</h3>
                </>
              )}
            </div>
          </motion.div>
        ) : (
          subscriptions.length === 1 ? (() => {
            const sub = subscriptions[0];
            const subExpired = daysBetween(sub?.end_date ?? '') <= 0;
            return (
          <motion.div className={`card subscription-card subscription-card--${subExpired ? 'expired' : 'active'}`} variants={staggerItem} data-subscription-id={sub.subscription_id ?? sub.id}>
            {(() => {
              const subId = sub.subscription_id ?? Number(sub.id);
              const days = daysBetween(sub.end_date ?? '');
              const isExpired = days <= 0;
              const isTrial = isTrialSubscription(sub);
              const statusClass = isExpired ? 'expired' : 'active';
              const statusText = isExpired ? 'Истекла' : 'Активна';
              const renewalDate = formatDate(sub.end_date ?? '', 'long');
              const autoRenewalText = sub.auto_renewal && !isExpired ? `Продление ${renewalDate}` : `Завершится ${renewalDate}`;
              return (
                <>
                  <div className="subscription-header">
                    <div className="subscription-title-row">
                      <span className={`subscription-title-icon ${isTrial ? 'trial' : 'vpn'}`} aria-hidden>
                        <i className={`fas ${isTrial ? 'fa-gift' : 'fa-shield-alt'}`} />
                      </span>
                      <div className="subscription-title-group">
                        <div className="subscription-title-name">
                          <h2 className="subscription-title">{getDisplayName(sub)}</h2>
                          <button type="button" className="subscription-rename-btn" onClick={() => handleRename(sub)} title="Переименовать" aria-label="Переименовать подписку">
                            <i className="fas fa-pen" />
                          </button>
                        </div>
                        {sub.custom_name && (
                          <span className="subscription-type-label">{getServiceTypeName(sub)}</span>
                        )}
                      </div>
                    </div>
                    <div className={`subscription-status ${statusClass}`}>
                      {statusClass === 'active' && <span className="subscription-status-dot" aria-hidden />}
                      <span>{statusText}</span>
                    </div>
                  </div>
                  <div className="subscription-info">
                    <div className="time-remaining">
                      <div className={`days-left ${isExpired ? 'text-red' : ''}`}>{Math.abs(days)}</div>
                      <div className="days-label">
                        {isExpired ? 'дней назад истекла' : `${pluralize(days, ['день остался', 'дня осталось', 'дней осталось'])}`}
                      </div>
                    </div>
                  </div>
                  {!isExpired && !isTrial && (
                    <div className="auto-renewal" data-subscription-id={subId} onClick={() => handleAutoRenewalToggle(subId, !!sub.auto_renewal)} role="button" tabIndex={0}>
                      <div className="auto-renewal-info">
                        <div className="auto-renewal-icon"><TgsPlayer src={`${ASSETS_GIFS}/auto-renewal.tgs`} fallbackIcon="fas fa-sync-alt" width={32} height={32} /></div>
                        <div className="auto-renewal-text">
                          <h4>Автопродление</h4>
                          <p className="auto-renewal-status">{autoRenewalText}</p>
                        </div>
                      </div>
                      <div className={`toggle-switch ${sub.auto_renewal ? 'active' : ''}`}><div className="toggle-slider" /></div>
                    </div>
                  )}
                  <div className="subscription-actions">
                    <button type="button" className="btn-trial-activation btn-renew" onClick={() => handleRenew(subId)} data-action="renew" data-subscription-id={subId}>
                      <div className="btn-trial-bg"><div className="btn-trial-shine" /><div className="btn-trial-glow" /></div>
                      <div className="btn-trial-content">
                        <div className="trial-icon-wrapper"><i className="fas fa-sync-alt" /></div>
                        <div className="trial-text">
                          <span className="trial-main">{isExpired ? 'Продлить подписку' : 'Продлить подписку'}</span>
                        </div>
                        <div className="trial-arrow"><i className="fas fa-arrow-right" /></div>
                      </div>
                    </button>
                  </div>
                </>
              );
            })()}
          </motion.div>
            );
          })() : (
          <motion.div className="subscriptions-compact" variants={staggerItem}>
            {subscriptions.map((sub) => {
              const subId = sub.subscription_id ?? Number(sub.id);
              const days = daysBetween(sub.end_date ?? '');
              const isExpired = days <= 0;
              const isTrial = isTrialSubscription(sub);
              const statusClass = isExpired ? 'expired' : 'active';
              const statusText = isExpired ? 'Истекла' : 'Активна';
              return (
                <div key={subId} className={`subscription-compact ${statusClass}`} data-subscription-id={subId}>
                  <div className="subscription-compact-info">
                    <div className="subscription-compact-icon">
                      <i className={`fas ${isTrial ? 'fa-gift' : 'fa-shield-alt'}`} />
                    </div>
                    <div className="subscription-compact-details">
                      <div className="subscription-compact-name-row">
                        <h4>{getDisplayName(sub)}</h4>
                        <button type="button" className="subscription-rename-btn subscription-rename-btn--compact" onClick={(e) => { e.stopPropagation(); handleRename(sub); }} title="Переименовать" aria-label="Переименовать подписку">
                          <i className="fas fa-pen" />
                        </button>
                      </div>
                      {sub.custom_name && (
                        <span className="subscription-type-label subscription-type-label--compact">{getServiceTypeName(sub)}</span>
                      )}
                      <p>{statusText}</p>
                    </div>
                  </div>
                  <div className="subscription-compact-status">
                    <div className={`subscription-compact-days ${isExpired ? 'text-red' : ''}`}>{Math.abs(days)}</div>
                    <div className="subscription-compact-label">{isExpired ? 'дн. назад' : 'дн. осталось'}</div>
                  </div>
                  <div className="subscription-compact-actions">
                    {!isTrial && !isExpired && (
                      <div className="subscription-compact-auto-renewal" data-subscription-id={subId} onClick={() => handleAutoRenewalToggle(subId, !!sub.auto_renewal)} role="button" tabIndex={0} title="Автопродление">
                        <div className={`toggle-switch-compact ${sub.auto_renewal ? 'active' : ''}`}><div className="toggle-slider-compact" /></div>
                      </div>
                    )}
                    <button type="button" className="btn-trial-activation btn-renew-compact" onClick={() => handleRenew(subId)} data-action="renew" data-subscription-id={subId}>
                      <div className="btn-trial-bg"><div className="btn-trial-shine" /><div className="btn-trial-glow" /></div>
                      <div className="btn-trial-content">
                        <div className="trial-icon-wrapper"><i className="fas fa-sync-alt" /></div>
                        <div className="trial-text"><span className="trial-main">Продлить</span></div>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </motion.div>
          )
        )}

        <motion.div className="subscription-bottom-actions" variants={staggerItem}>
          <button type="button" className="btn btn-primary btn-action-primary" onClick={handleBuy} data-action="buy">
            <i className="fas fa-plus" /> Новая подписка
          </button>
          <button type="button" className="btn btn-secondary btn-action-secondary" onClick={handleGift} data-action="gift">
            <i className="fas fa-gift" /> Подарить подписку
          </button>
        </motion.div>

        <motion.div className="section" variants={staggerItem}>
          <h2 className="section-title">
            <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}><TgsPlayer src={`${ASSETS_GIFS}/management.tgs`} fallbackIcon="fas fa-cog" width={32} height={32} /></span>
            Управление
          </h2>
          <div className="notcoin-actions-grid">
            <div className="notcoin-action-card" onClick={handleInstructions} role="button" tabIndex={0} data-action="instructions">
              <div className="notcoin-action-content">
                <div className="notcoin-action-text">
                  <div className="notcoin-action-title">Инструкции</div>
                  <div className="notcoin-action-subtitle">Как настроить VPN</div>
                </div>
                <div className="notcoin-decorative-icon"><i className="fas fa-book-open" /></div>
              </div>
            </div>
            <div className="notcoin-action-card" onClick={handleSupport} role="button" tabIndex={0} data-action="support">
              <div className="notcoin-action-content">
                <div className="notcoin-action-text">
                  <div className="notcoin-action-title">Поддержка</div>
                  <div className="notcoin-action-subtitle">Помощь 24/7</div>
                </div>
                <div className="notcoin-decorative-icon"><i className="fas fa-comment-dots" /></div>
              </div>
            </div>
            <div className="notcoin-action-card" onClick={handleActivateCode} role="button" tabIndex={0} data-action="activate-code">
              <div className="notcoin-action-content">
                <div className="notcoin-action-text">
                  <div className="notcoin-action-title">Активировать код</div>
                  <div className="notcoin-action-subtitle">Введите код подарка</div>
                </div>
                <div className="notcoin-decorative-icon"><i className="fas fa-key" /></div>
              </div>
            </div>
            <div className="notcoin-action-card" onClick={handleNewsChannel} role="button" tabIndex={0} data-action="news-channel">
              <div className="notcoin-action-content">
                <div className="notcoin-action-text">
                  <div className="notcoin-action-title">Новости</div>
                  <div className="notcoin-action-subtitle">Актуальные обновления</div>
                </div>
                <div className="notcoin-decorative-icon"><i className="fas fa-newspaper" /></div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <DailyBonusModal open={dailyBonusModalOpen} onClose={() => setDailyBonusModalOpen(false)} />
      <CurrencyModal open={currencyModalOpen} onClose={() => setCurrencyModalOpen(false)} />

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
