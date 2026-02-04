import { create } from 'zustand';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '../../core/utils';

interface PendingPayment {
  id: string;
  payment_id?: string;
  status?: string;
  created_at?: string;
  confirmation_url?: string;
  payment_url?: string;
  url?: string;
  receipt_link?: string;
  service_name?: string;
  service_duration?: string;
  price?: number;
}

interface PaymentBannerState {
  payment: PendingPayment | null;
  show: (p: PendingPayment) => void;
  hide: () => void;
}

export const usePaymentBannerStore = create<PaymentBannerState>(set => ({
  payment: null,
  show: (p) => set({ payment: p?.status === 'pending' ? p : null }),
  hide: () => set({ payment: null }),
}));

export function usePaymentBanner() {
  const { payment, show, hide } = usePaymentBannerStore();
  return {
    payment,
    showBanner: useCallback((p: PendingPayment) => {
      if (p?.status === 'pending' && (p.payment_url || p.url || p.confirmation_url)) show(p);
    }, [show]),
    hideBanner: hide,
  };
}

function getTimeLeft(createdAt?: string): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt).getTime();
  const hour = 60 * 60 * 1000;
  return Math.max(0, Math.floor((hour - (Date.now() - created)) / 1000));
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PaymentBanner() {
  const { payment, hide } = usePaymentBannerStore();
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(payment?.created_at));

  useEffect(() => {
    const main = document.getElementById('mainContent');
    if (!main) return;
    main.classList.toggle('with-payment-banner', !!payment);
    return () => { main.classList.remove('with-payment-banner'); };
  }, [payment]);

  useEffect(() => {
    if (!payment || payment.status !== 'pending') return;
    setTimeLeft(getTimeLeft(payment.created_at));
    const id = setInterval(() => {
      const t = getTimeLeft(payment.created_at);
      setTimeLeft(t);
      if (t <= 0) {
        clearInterval(id);
        hide();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [payment?.id, payment?.created_at, payment?.status, hide]);

  const openPaymentUrl = useCallback(() => {
    const url = payment?.confirmation_url ?? payment?.payment_url ?? payment?.url;
    if (url) {
      if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url);
      else window.open(url, '_blank');
    }
    hide();
  }, [payment, hide]);

  const isPending = payment?.status === 'pending';
  const progress = isPending ? (timeLeft / 3600) * 100 : 100;

  return (
    <AnimatePresence>
      {payment && (
        <motion.div
          key={payment.id}
          className="payment-banner"
          id="paymentBanner"
          initial={{ opacity: 0, y: -16, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -12, x: '-50%' }}
          transition={{ duration: 0.3 }}
          style={{ left: '50%' }}
        >
      <div className="payment-banner-content">
        <div className="payment-info">
          <div className="payment-timer">
            <div className="timer-circle">
              <svg className={`timer-progress ${isPending ? 'active' : ''}`} width="32" height="32" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14" fill="none" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeDasharray={88} strokeDashoffset={88 - (88 * progress) / 100} />
              </svg>
              <span className="timer-text">{isPending ? formatTime(timeLeft) : '✓'}</span>
            </div>
            <div className="payment-text">
              <div className="payment-title">{payment.service_name ?? 'VPN подписка'}</div>
              <div className="payment-subtitle">
                {formatPrice(payment.price ?? 0)}
                {payment.service_duration ? ` • ${payment.service_duration}` : ''}
                {!isPending ? ' • Оплачено' : ' • Ожидание оплаты'}
              </div>
            </div>
          </div>
        </div>
        <button type="button" className="btn btn-sm btn-primary" onClick={openPaymentUrl}>
          {isPending ? 'Продолжить оплату' : 'Чек'}
        </button>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

