import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { servicesApi, userApi, paymentApi, subscriptionApi } from '../../core/api/endpoints';
import { clearApiCache } from '../../core/api/client';
import { useModalsStore } from '../../app/modalsStore';
import { useToast } from '../../shared/ui/Toast';
import { useTelegram } from '../../core/telegram/hooks';
import { formatPrice, formatDurationDays } from '../../core/utils';
import { modalBackdrop, modalPanel } from '../../shared/motion/variants';
import { TgsPlayer, ASSETS_GIFS } from '../../shared/ui/TgsPlayer';
import { daysBetween } from '../../core/utils';
import { usePaymentBannerStore } from '../../shared/ui/PaymentBanner';

interface ServiceSelectorModalProps {
  open: boolean;
  mode: 'buy' | 'renew' | 'gift';
  subscriptionId?: number;
  onClose: () => void;
  onSuccess: () => void;
}

type ServiceItem = {
  id?: number;
  service_id?: number;
  name?: string;
  price?: number;
  original_price?: number;
  duration_days?: number;
  is_trial?: boolean;
  is_featured?: boolean;
  has_discount?: boolean;
  discount_percent?: number;
  badge?: string;
  sort_order?: number;
};

export function ServiceSelectorModal({ open, mode, subscriptionId, onClose, onSuccess }: ServiceSelectorModalProps) {
  const toast = useToast();
  const tg = useTelegram();
  const { openInstructions } = useModalsStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);

  const { data: user } = useQuery({ queryKey: ['user'], queryFn: () => userApi.getCurrentUser(), enabled: open });
  const userId = (user as { telegram_id?: number })?.telegram_id ?? (user as { user_id?: number })?.user_id;
  const trialActivated = (user as { user?: { trial_activated?: boolean } })?.user?.trial_activated ?? (user as { trial_activated?: boolean })?.trial_activated === true;

  const { data: subsRes } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionApi.list(),
    enabled: open && mode === 'buy',
  });
  const subs = (Array.isArray(subsRes) ? subsRes : (subsRes as { subscriptions?: { end_date?: string; status?: string }[] })?.subscriptions ?? []) as { end_date?: string; status?: string }[];
  const hasActiveSubscription = subs.some(s => daysBetween(s.end_date ?? '') > 0 && (s.status === 'active' || s.status === 'trial'));

  const { data: servicesRes } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesApi.list(),
    enabled: open,
  });
  const raw = Array.isArray(servicesRes) ? servicesRes : (servicesRes as { services?: unknown[] })?.services ?? [];
  const allServices = raw as ServiceItem[];
  const trialService = allServices.find(s => s.is_trial) ?? null;
  const services = allServices
    .filter(s => !s.is_trial)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (Number(a.price) - Number(b.price)));

  const isTrialSelected = trialService != null && selectedId === (trialService.service_id ?? trialService.id);

  const handleContinue = async () => {
    if (!selectedId || !userId) return;
    tg?.haptic.light();
    try {
      if (mode === 'gift') {
        onSuccess();
        onClose();
        return;
      }

      // If the selected service is a trial — call the trial activation endpoint (no payment)
      if (isTrialSelected) {
        setTrialLoading(true);
        try {
          await subscriptionApi.activateTrial();
          toast.success('Пробный период активирован');
          clearApiCache('/subscription/subscriptions/user');
          clearApiCache('/user/user');
          tg?.haptic.success();
          onSuccess();
          onClose();
          // Show instructions after the modal closes
          setTimeout(() => openInstructions(), 300);
        } finally {
          setTrialLoading(false);
        }
        return;
      }

      type PaymentRes = {
        payment?: { id?: string; payment_id?: number | string; confirmation_url?: string };
        confirmation_url?: string;
        url?: string;
        id?: string;
        payment_id?: number | string;
      };

      let res: PaymentRes | undefined;

      if (mode === 'buy') {
        res = await paymentApi.createSubscription({ service_id: selectedId }, userId) as PaymentRes;
      } else if (mode === 'renew' && subscriptionId) {
        res = await paymentApi.createRenewal({ subscription_id: subscriptionId, service_id: selectedId }, userId) as PaymentRes;
      }

      const url = res?.payment?.confirmation_url ?? res?.confirmation_url ?? res?.url;

      if (url) {
        tg?.openLink?.(url);

        // Show payment banner immediately so user sees the pending payment
        const selectedService = allServices.find(s => (s.service_id ?? s.id) === selectedId);
        const rawId = res?.payment?.payment_id ?? res?.payment?.id ?? res?.payment_id ?? res?.id;
        const paymentId = rawId != null ? String(rawId) : `payment_${Date.now()}`;
        usePaymentBannerStore.getState().show({
          id: paymentId,
          status: 'pending',
          created_at: new Date().toISOString(),
          confirmation_url: url,
          payment_url: url,
          url,
          service_name: selectedService?.name,
          service_id: selectedId,
          price: selectedService?.price,
          service_duration: selectedService?.duration_days != null
            ? formatDurationDays(selectedService.duration_days)
            : undefined,
          mode: mode === 'renew' ? 'renew' : 'buy',
        });
      } else {
        toast.error('Не получена ссылка на оплату');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as Error & { data?: { comment?: string } };
      toast.error(e.data?.comment ?? e.message ?? 'Ошибка');
    }
  };

  const handleSelect = (id: number) => {
    if (trialService && (trialService.service_id === id || trialService.id === id)) {
      if (trialActivated) {
        toast.warning('Пробный период уже использован');
        return;
      }
    }
    tg?.haptic.selection?.();
    setSelectedId(id);
  };

  const title = mode === 'renew' ? 'Продление подписки' : mode === 'gift' ? 'Подарить подписку' : 'Новая подписка';

  let explanationText = '';
  if (mode === 'renew') {
    explanationText = '<i class="fas fa-sync-alt"></i> Выберите тариф для продления. Новый период добавится к текущему.';
  } else if (mode === 'gift') {
    explanationText = '<i class="fas fa-gift"></i> Выберите подписку, которую хотите подарить.';
  } else {
    explanationText = hasActiveSubscription
      ? '<i class="fas fa-info-circle"></i> У вас уже есть подписка. Оплата создаст новую отдельную подписку.'
      : '<i class="fas fa-rocket"></i> Выберите подходящий тариф для начала работы с VPN.';
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-overlay active" {...modalBackdrop} onClick={onClose}>
          <motion.div className="modal modal-services" {...modalPanel} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fas fa-shopping-cart" /> {title}
              </div>
              <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="modal-body">
              <div className="service-explanation" dangerouslySetInnerHTML={{ __html: explanationText }} />

              <div className="services-grid-compact">
                {services.map(s => {
                  const id = s.service_id ?? s.id!;
                  const isSelected = selectedId === id;
                  const originalPrice = s.original_price ?? s.price;
                  const hasDiscount = s.has_discount && s.original_price != null && Number(s.price) < Number(s.original_price);
                  const isFeatured = s.is_featured || hasDiscount;
                  return (
                    <div
                      key={id}
                      className={`service-card-compact ${isFeatured ? 'featured' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelect(id)}
                      role="button"
                      tabIndex={0}
                      data-service-id={id}
                    >
                      {s.badge && <div className="service-badge">{s.badge}</div>}
                      {hasDiscount && s.discount_percent != null && (
                        <div className="service-discount-badge">-{s.discount_percent}%</div>
                      )}
                      <div className="service-compact-content">
                        <div className="service-compact-pricing">
                          {hasDiscount && (
                            <div className="service-original-price">{formatPrice(Number(originalPrice))}</div>
                          )}
                          <div className={`service-compact-price ${hasDiscount ? 'has-discount' : ''}`}>
                            {formatPrice(s.price ?? 0)}
                          </div>
                        </div>
                        <div className="service-compact-period">{formatDurationDays(s.duration_days ?? 0)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {mode !== 'gift' && trialService && (
                <div
                  className={`trial-service ${trialActivated ? 'trial-activated' : 'trial-available'} ${selectedId === (trialService.service_id ?? trialService.id) ? 'selected' : ''}`}
                  onClick={() => !trialActivated && handleSelect(trialService.service_id ?? trialService.id!)}
                  role="button"
                  tabIndex={0}
                  data-service-id={trialService.service_id ?? trialService.id}
                >
                  <div className="service-badge trial-badge">Бесплатно</div>
                  <div className="trial-content">
                    <div className="trial-icon">
                      <TgsPlayer
                        src={trialActivated ? `${ASSETS_GIFS}/gift-opened.png` : `${ASSETS_GIFS}/gift-animate.tgs`}
                        fallbackIcon="fas fa-gift"
                        width={48}
                        height={48}
                      />
                    </div>
                    <div className="trial-info">
                      <h4 className="trial-title">{trialService.name}</h4>
                      <div className="trial-duration">{formatDurationDays(trialService.duration_days ?? 0)}</div>
                    </div>
                    <div className="trial-status">{trialActivated ? 'Использован' : 'Доступен'}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedId || trialLoading}
                onClick={handleContinue}
              >
                {trialLoading ? (
                  <><i className="fas fa-spinner fa-spin" /> Активация...</>
                ) : isTrialSelected ? (
                  <><i className="fas fa-gift" /> Активировать</>
                ) : (
                  <><i className="fas fa-arrow-right" /> {mode === 'gift' ? 'Далее' : 'Продолжить'}</>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
