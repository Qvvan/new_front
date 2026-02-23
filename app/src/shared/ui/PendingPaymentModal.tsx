import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '../../core/utils';
import { usePaymentBannerStore } from './PaymentBanner';
import { modalBackdrop, modalPanel } from '../motion/variants';

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

export interface PendingPaymentModalProps {
  open: boolean;
  onClose: () => void;
}

export function PendingPaymentModal({ open, onClose }: PendingPaymentModalProps) {
  const { payment, hide } = usePaymentBannerStore();
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(payment?.created_at));

  useEffect(() => {
    if (!payment || payment.status !== 'pending') return;
    setTimeLeft(getTimeLeft(payment.created_at));
    const id = setInterval(() => {
      const t = getTimeLeft(payment.created_at);
      setTimeLeft(t);
      if (t <= 0) {
        clearInterval(id);
        hide();
        onClose();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [payment?.id, payment?.created_at, payment?.status, hide, onClose]);

  const openPaymentUrl = useCallback(() => {
    const url = payment?.confirmation_url ?? payment?.payment_url ?? payment?.url;
    if (url) {
      if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url);
      else window.open(url, '_blank');
    }
    hide();
    onClose();
  }, [payment, hide, onClose]);

  const handleClose = useCallback(() => {
    hide();
    onClose();
  }, [hide, onClose]);

  const isPending = payment?.status === 'pending';
  const progressPercent = isPending ? (timeLeft / 3600) * 100 : 100;
  const circumference = 125.6;
  const strokeDashoffset = circumference - (circumference * progressPercent) / 100;
  const p = Math.max(0, Math.min(1, progressPercent / 100));
  const strokeColor = isPending
    ? `rgb(${Math.round(34 + (239 - 34) * (1 - p))}, ${Math.round(197 + (68 - 197) * (1 - p))}, ${Math.round(94 + (68 - 94) * (1 - p))})`
    : '#22c55e';
  const circleStyle: React.CSSProperties = {
    fill: 'none',
    stroke: strokeColor,
    strokeWidth: 3,
    strokeLinecap: 'round',
    strokeDasharray: circumference,
    strokeDashoffset,
  };

  const show = open && payment;

  const content = (
    <AnimatePresence>
      {show && (
        <motion.div
          className="modal-overlay active"
          {...modalBackdrop}
          onClick={handleClose}
        >
          <motion.div
            className="modal pending-payment-modal"
            {...modalPanel}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">Ожидающий платёж</div>
              <button type="button" className="modal-close" onClick={handleClose} aria-label="Закрыть">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="modal-body pending-payment-modal-body">
              <div className="payment-info">
                <div className="payment-timer">
                  <div className="timer-circle">
                    <svg className={`timer-progress ${isPending ? 'active' : ''}`} width="44" height="44" viewBox="0 0 44 44">
                      <circle cx="22" cy="22" r="20" style={circleStyle} />
                    </svg>
                    <span className="timer-text">{isPending ? formatTime(timeLeft) : '✓'}</span>
                  </div>
                  <div className="payment-text">
                    <div className="payment-title">{payment.service_name ?? 'VPN подписка'}</div>
                    <div className="payment-subtitle">
                      {formatPrice(payment.price ?? payment.amount ?? 0)}
                      {payment.service_duration ? ` • ${payment.service_duration}` : ''}
                      {!isPending ? ' • Оплачено' : ' • Ожидание оплаты'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary btn-full" onClick={openPaymentUrl}>
                {isPending ? 'Продолжить оплату' : 'Чек'}
              </button>
              <button type="button" className="btn btn-secondary btn-full" onClick={handleClose}>
                Закрыть
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
