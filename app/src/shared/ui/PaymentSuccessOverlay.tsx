import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalsStore } from '../../app/modalsStore';
import { formatPrice } from '../../core/utils';
import { useTelegram } from '../../core/telegram/hooks';
import type { SuccessfulPayment } from '../../hooks/usePaymentPolling';

interface Props {
  payment: SuccessfulPayment | null;
  onDismiss: () => void;
}

/**
 * Full-screen overlay shown when a pending payment succeeds.
 * - New subscription ('buy'): shows success + opens Instructions modal on dismiss.
 * - Renewal ('renew'): shows renewal success, just dismisses.
 * - Gift ('gift'): shows gift success, then opens GiftSuccessModal with promocode and instructions.
 */
export function PaymentSuccessOverlay({ payment, onDismiss }: Props) {
  const { openInstructions, openGiftSuccess } = useModalsStore();
  const tg = useTelegram();

  const pType = payment?.paymentType ?? 'buy';
  const needsInstructions = pType === 'buy';
  const isGift = pType === 'gift';

  const handleClick = () => {
    tg?.haptic.success?.();
    onDismiss();
    if (needsInstructions) {
      setTimeout(() => openInstructions(), 300);
    } else if (isGift) {
      const giftId = (payment as { giftId?: number | null })?.giftId ?? null;
      setTimeout(() => openGiftSuccess(giftId), 300);
    }
  };

  // Texts per payment type
  const title =
    pType === 'renew' ? 'Подписка продлена!' :
    pType === 'gift' ? 'Подарок оплачен!' :
    'Оплата прошла успешно!';

  const icon =
    pType === 'renew' ? 'fa-sync-alt' :
    pType === 'gift' ? 'fa-gift' :
    'fa-check';

  const subtitle =
    pType === 'renew' ? 'Срок вашей подписки обновлён' :
    pType === 'gift' ? 'Подарочная подписка готова к отправке' :
    'Необходимо пройти инструкцию по активации';

  const content = (
    <AnimatePresence>
      {payment && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={handleClick}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            // Fully opaque — no content bleeds through
            background: 'radial-gradient(circle at center, rgb(16, 28, 16) 0%, rgb(10, 10, 10) 60%)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div className="payment-success-content">
            <div className="payment-success-icon">
              <i className={`fas ${icon}`} />
            </div>
            <div className="payment-success-title">
              {title}
            </div>
            <div className="payment-success-text">
              {payment.service_name && (
                <div style={{ marginBottom: '8px' }}>{payment.service_name}</div>
              )}
              <div style={{ fontSize: '1.2em', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatPrice(payment.price ?? payment.amount ?? 0)}
              </div>
              <div style={{ marginTop: '16px' }}>
                {subtitle}
              </div>
            </div>
            <motion.div
              style={{
                marginTop: '32px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
              }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Нажмите, чтобы продолжить
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
