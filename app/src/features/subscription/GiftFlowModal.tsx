import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { servicesApi, giftApi } from '../../core/api/endpoints';
import { useToast } from '../../shared/ui/Toast';
import { useTelegram } from '../../core/telegram/hooks';
import { formatPrice } from '../../core/utils';
import { modalBackdrop, modalPanel } from '../../shared/motion/variants';
import { usePaymentBannerStore } from '../../shared/ui/PaymentBanner';
import { storage } from '../../core/storage';

interface GiftFlowModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function formatDuration(days: number): string {
  if (days >= 360) return `${Math.round(days / 365)} год`;
  if (days >= 30) return `${Math.round(days / 30)} мес`;
  return `${days} дн`;
}

const NAME_PATTERN = /^[a-zA-Zа-яА-ЯёЁ\s]*$/;

export function GiftFlowModal({ open, onClose, onSuccess }: GiftFlowModalProps) {
  const toast = useToast();
  const tg = useTelegram();
  const showBanner = usePaymentBannerStore(s => s.show);

  const [step, setStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: servicesRes } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesApi.list(),
    enabled: open,
  });
  const raw = Array.isArray(servicesRes) ? servicesRes : (servicesRes as { services?: unknown[] })?.services ?? [];
  const services = (raw as { id?: number; service_id?: number; name?: string; price?: number; duration_days?: number }[]).filter(s => !(s as { is_trial?: boolean }).is_trial);
  const selectedService = selectedServiceId != null ? services.find(s => (s.service_id ?? s.id) === selectedServiceId) : null;

  const reset = useCallback(() => {
    setStep(1);
    setSelectedServiceId(null);
    setSenderName('');
    setMessage('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleStep1Next = useCallback(() => {
    if (!selectedServiceId) {
      toast.warning('Выберите подписку для подарка');
      return;
    }
    tg?.haptic.light?.();
    setStep(2);
  }, [selectedServiceId, toast, tg]);

  const handleStep2Next = useCallback(() => {
    const name = senderName.trim();
    if (name && !NAME_PATTERN.test(name)) {
      toast.error('Имя может содержать только буквы и пробелы');
      return;
    }
    tg?.haptic.light?.();
    setStep(3);
  }, [senderName, toast, tg]);

  const handlePay = useCallback(async () => {
    if (!selectedServiceId) return;
    setLoading(true);
    tg?.haptic.light?.();
    try {
      const res = await giftApi.create({
        service_id: selectedServiceId,
        sender_display_name: senderName.trim() || undefined,
        message: message.trim() || undefined,
      }) as { payment?: { payment_id?: string; confirmation_url?: string; status?: string; service_name?: string; service_duration?: string; created_at?: string }; confirmation_url?: string };

      const payment = res?.payment;
      const paymentUrl = payment?.confirmation_url ?? res?.confirmation_url;

      if (paymentUrl) {
        tg?.openLink?.(paymentUrl);
        if (payment?.payment_id && payment?.status === 'pending') {
          const toStore = {
            id: String(payment.payment_id),
            payment_id: payment.payment_id,
            status: 'pending' as const,
            confirmation_url: paymentUrl,
            payment_url: paymentUrl,
            url: paymentUrl,
            service_name: payment.service_name ?? selectedService?.name,
            service_duration: selectedService ? formatDuration(selectedService.duration_days ?? 0) : undefined,
            created_at: payment.created_at ?? new Date().toISOString(),
          };
          await storage.addPendingPayment(toStore);
          showBanner({ ...toStore, price: selectedService?.price });
        }
        toast.success('Переход к оплате...');
      } else {
        toast.error('Не получен URL для оплаты');
        return;
      }
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const e = err as Error & { data?: { comment?: string } };
      toast.error(e.data?.comment ?? e.message ?? 'Ошибка создания подарка');
    } finally {
      setLoading(false);
    }
  }, [selectedServiceId, senderName, message, selectedService, tg, toast, onSuccess, handleClose, showBanner]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div className="modal-overlay active" {...modalBackdrop} onClick={handleClose}>
        <motion.div className="modal modal-services modal-gift-flow" {...modalPanel} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title"><i className="fas fa-gift" /> Подарить подписку</div>
            <button type="button" className="modal-close" onClick={handleClose} aria-label="Закрыть"><i className="fas fa-times" /></button>
          </div>
          <div className="modal-body">
            {step === 1 && (
              <div className="gift-flow-step gift-step-1">
                <div className="gift-step-content">
                  <p className="gift-step-description">
                    <i className="fas fa-gift" /> Выберите подписку, которую хотите подарить
                  </p>
                  <div className="services-grid-compact">
                    {services.map(s => {
                      const id = s.service_id ?? s.id!;
                      const isSelected = selectedServiceId === id;
                      return (
                        <div
                          key={id}
                          className={`service-card-compact ${isSelected ? 'selected' : ''}`}
                          onClick={() => { setSelectedServiceId(id); tg?.haptic.selection?.(); }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="service-compact-content">
                            <div className="service-compact-pricing">
                              <div className="service-compact-price">{formatPrice(s.price ?? 0)}</div>
                            </div>
                            <div className="service-compact-period">{formatDuration(s.duration_days ?? 0)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="gift-flow-step gift-step-2">
                <div className="gift-step-content">
                  <p className="gift-step-description">
                    <i className="fas fa-gift" /> Заполните информацию о подарке
                  </p>
                  <div className="gift-form-fields">
                    <div className="gift-field">
                      <label htmlFor="gift-sender-name">Ваше имя (для получателя)</label>
                      <input
                        type="text"
                        id="gift-sender-name"
                        className="gift-input"
                        placeholder="Оставьте пустым для анонимного подарка"
                        maxLength={100}
                        value={senderName}
                        onChange={e => setSenderName(e.target.value)}
                      />
                      <small className="gift-field-hint">Только буквы и пробелы</small>
                    </div>
                    <div className="gift-field">
                      <label htmlFor="gift-message">Сообщение для получателя (необязательно)</label>
                      <textarea
                        id="gift-message"
                        className="gift-textarea"
                        placeholder="Напишите добрые пожелания..."
                        maxLength={500}
                        rows={4}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                      />
                      <small className="gift-field-hint">До 500 символов</small>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && selectedService && (
              <div className="gift-flow-step gift-step-3">
                <div className="gift-summary">
                  <div className="gift-summary-section">
                    <h4 className="gift-summary-title"><i className="fas fa-gift" /> Что дарите</h4>
                    <div className="gift-summary-item">
                      <span className="gift-summary-label">Услуга:</span>
                      <span className="gift-summary-value">{selectedService.name}</span>
                    </div>
                    <div className="gift-summary-item">
                      <span className="gift-summary-label">Срок:</span>
                      <span className="gift-summary-value">{formatDuration(selectedService.duration_days ?? 0)}</span>
                    </div>
                    <div className="gift-summary-item">
                      <span className="gift-summary-label">Цена:</span>
                      <span className="gift-summary-value gift-price">{formatPrice(selectedService.price ?? 0)}</span>
                    </div>
                  </div>
                  <div className="gift-summary-section">
                    <h4 className="gift-summary-title"><i className="fas fa-user" /> Информация о подарке</h4>
                    <div className="gift-summary-item">
                      <span className="gift-summary-label">Тип:</span>
                      <span className="gift-summary-value">Будет создан код активации</span>
                    </div>
                    {senderName.trim() && (
                      <div className="gift-summary-item">
                        <span className="gift-summary-label">От кого:</span>
                        <span className="gift-summary-value">{senderName.trim()}</span>
                      </div>
                    )}
                    {message.trim() && (
                      <div className="gift-summary-item gift-summary-message">
                        <span className="gift-summary-label">Сообщение:</span>
                        <span className="gift-summary-value">{message.trim()}</span>
                      </div>
                    )}
                  </div>
                  <div className="gift-summary-note">
                    <i className="fas fa-info-circle" />
                    <p>Обратите внимание: подарок не будет автоматически продлеваться. После окончания срока действия подписка завершится.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="modal-actions">
            {step === 1 && (
              <>
                <button type="button" className="btn btn-secondary" onClick={handleClose}>Отмена</button>
                <button type="button" className="btn btn-primary" disabled={!selectedServiceId} onClick={handleStep1Next}>Далее</button>
              </>
            )}
            {step === 2 && (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Назад</button>
                <button type="button" className="btn btn-primary" onClick={handleStep2Next}>Далее</button>
              </>
            )}
            {step === 3 && (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>Назад</button>
                <button type="button" className="btn btn-primary" disabled={loading} onClick={handlePay}>
                  {loading ? 'Создание...' : 'Перейти к оплате'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
