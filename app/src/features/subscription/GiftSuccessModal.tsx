import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useModalsStore } from '../../app/modalsStore';
import { userApi, giftApi } from '../../core/api/endpoints';
import { useToast } from '../../shared/ui/Toast';
import { useTelegram } from '../../core/telegram/hooks';
import { copyToClipboard, formatDurationDays } from '../../core/utils';
import { modalBackdrop, modalPanel } from '../../shared/motion/variants';

type Gift = {
  gift_id?: number;
  id?: number;
  gift_code?: string;
  status?: string;
  service_id?: number;
  service_name?: string;
  duration_days?: number;
  sender_display_name?: string;
  message?: string;
  recipient_user_id?: number | null;
  recipient_name?: string | null;
  created_at?: string;
};

export function GiftSuccessModal() {
  const { giftSuccess, closeGiftSuccess } = useModalsStore();
  const toast = useToast();
  const tg = useTelegram();
  const open = giftSuccess.open;
  const giftId = giftSuccess.giftId;

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => userApi.getCurrentUser(),
    enabled: open && !giftId,
  });
  const userId = (user as { telegram_id?: number })?.telegram_id ?? (user as { user_id?: number })?.user_id;

  const { data: giftById } = useQuery({
    queryKey: ['gift', giftId],
    queryFn: () => giftApi.get(giftId!),
    enabled: open && !!giftId,
  });

  const { data: sentList } = useQuery({
    queryKey: ['gifts', 'sent', userId],
    queryFn: () => giftApi.getSent(userId!),
    enabled: open && !giftId && !!userId,
  });

  const gift: Gift | null = giftId && giftById
    ? (giftById as Gift)
    : Array.isArray(sentList) && sentList.length > 0
      ? (sentList as Gift[]).sort((a, b) =>
          new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        )[0]
      : null;

  const handleCopy = async () => {
    if (!gift?.gift_code) return;
    const ok = await copyToClipboard(gift.gift_code);
    if (ok) {
      toast.success('Код скопирован!');
      tg?.haptic?.light?.();
    } else {
      toast.error('Не удалось скопировать');
    }
  };

  const handleClose = () => {
    tg?.haptic?.light?.();
    closeGiftSuccess();
  };

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-overlay active" {...modalBackdrop} onClick={handleClose}>
          <motion.div className="modal modal-services modal-gift-success" {...modalPanel} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <i className="fas fa-gift" /> Подарок успешно куплен
              </div>
              <button type="button" className="modal-close" onClick={handleClose} aria-label="Закрыть">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="modal-body">
              {gift ? (
                <>
                  <p className="gift-success-intro">
                    Передайте код получателю. Чтобы активировать подарок, нужно вставить этот код в раздел «Промокоды» → «Активировать код».
                  </p>
                  <div className="gift-success-code-block">
                    <span className="gift-success-code-label">Код активации</span>
                    <div className="gift-code-container gift-success-code">
                      <span className="detail-value" id="gift-success-code-value">{gift.gift_code}</span>
                      <button type="button" className="btn-copy-code" onClick={handleCopy}>
                        <i className="fas fa-copy" /> Копировать
                      </button>
                    </div>
                  </div>
                  <div className="gift-summary gift-success-summary">
                    <div className="gift-summary-section">
                      <h4 className="gift-summary-title"><i className="fas fa-info-circle" /> Что указано в подарке</h4>
                      <div className="gift-summary-item">
                        <span className="gift-summary-label">Услуга:</span>
                        <span className="gift-summary-value">{gift.service_name ?? 'Подписка'}</span>
                      </div>
                      {gift.duration_days != null && (
                        <div className="gift-summary-item">
                          <span className="gift-summary-label">Срок:</span>
                          <span className="gift-summary-value">{formatDurationDays(gift.duration_days)}</span>
                        </div>
                      )}
                      {gift.sender_display_name != null && gift.sender_display_name !== '' && (
                        <div className="gift-summary-item">
                          <span className="gift-summary-label">Имя дарителя:</span>
                          <span className="gift-summary-value">{gift.sender_display_name}</span>
                        </div>
                      )}
                      {(gift.recipient_name != null && gift.recipient_name !== '') && (
                        <div className="gift-summary-item">
                          <span className="gift-summary-label">Получатель:</span>
                          <span className="gift-summary-value">{gift.recipient_name}</span>
                        </div>
                      )}
                      {gift.recipient_user_id != null && (gift.recipient_name == null || gift.recipient_name === '') && (
                        <div className="gift-summary-item">
                          <span className="gift-summary-label">Получатель:</span>
                          <span className="gift-summary-value">ID: {gift.recipient_user_id}</span>
                        </div>
                      )}
                      {gift.message != null && gift.message !== '' && (
                        <div className="gift-summary-item gift-summary-message">
                          <span className="gift-summary-label">Сообщение:</span>
                          <span className="gift-summary-value">{gift.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="gift-success-loading">
                  <i className="fas fa-spinner fa-spin" /> Загрузка данных подарка...
                </div>
              )}
            </div>
            <div className="modal-actions modal-actions--single">
              <button type="button" className="btn btn-primary" onClick={handleClose}>
                Понятно
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
