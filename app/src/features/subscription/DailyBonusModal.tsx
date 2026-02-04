import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { currencyApi } from '../../core/api/endpoints';
import { useToast } from '../../shared/ui/Toast';
import { useTelegram } from '../../core/telegram/hooks';
import { formatTimeUntil } from '../../core/utils';
import { modalBackdrop, modalPanel } from '../../shared/motion/variants';

interface DailyBonusModalProps {
  open: boolean;
  onClose: () => void;
}

type BonusItem = { day_number: number; amount: number; is_final?: boolean };
type Status = { current_streak?: number; next_streak?: number; can_claim?: boolean; next_claim_available_at?: string };
type ListRes = { bonuses?: BonusItem[] };

export function DailyBonusModal({ open, onClose }: DailyBonusModalProps) {
  const toast = useToast();
  const tg = useTelegram();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollFade, setScrollFade] = useState({ left: false, right: true });

  const { data: statusData } = useQuery({
    queryKey: ['dailyBonus'],
    queryFn: () => currencyApi.getDailyBonusStatus(),
    enabled: open,
  });
  const { data: listData } = useQuery({
    queryKey: ['dailyBonusList'],
    queryFn: () => currencyApi.getDailyBonusList() as Promise<ListRes>,
    enabled: open,
  });

  const claimDailyBonus = useMutation({
    mutationFn: () => currencyApi.claimDailyBonus(),
    onSuccess: () => {
      toast.success('Бонус получен!');
      queryClient.invalidateQueries({ queryKey: ['currencyBalance'] });
      queryClient.invalidateQueries({ queryKey: ['dailyBonus'] });
      queryClient.invalidateQueries({ queryKey: ['dailyBonusList'] });
      tg?.haptic.success();
    },
    onError: (err: Error & { data?: { comment?: string } }) => {
      toast.error(err.data?.comment ?? err.message ?? 'Ошибка получения бонуса');
    },
  });

  const status = (statusData ?? {}) as Status;
  const bonuses = (listData as ListRes)?.bonuses ?? [];
  const currentStreak = status.current_streak ?? 0;
  const nextStreak = status.next_streak ?? 0;
  const canClaim = status.can_claim === true;
  const nextClaimAt = status.next_claim_available_at;

  useEffect(() => {
    if (!open || !scrollRef.current || bonuses.length === 0) return;
    const container = scrollRef.current;
    const targetDay = canClaim && nextStreak > 0 ? nextStreak : currentStreak > 0 ? currentStreak : 1;
    const targetCard = container.querySelector(`[data-day="${targetDay}"]`) ?? container.querySelector(`[data-index="${targetDay - 1}"]`);
    if (targetCard instanceof HTMLElement) {
      const cardLeft = targetCard.offsetLeft;
      const cardWidth = targetCard.offsetWidth;
      const containerWidth = container.clientWidth;
      container.scrollLeft = Math.max(0, cardLeft - containerWidth / 2 + cardWidth / 2);
    }
    updateScrollFade(container);
  }, [open, bonuses.length, canClaim, nextStreak, currentStreak]);

  const updateScrollFade = (el: HTMLDivElement) => {
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setScrollFade({
      left: scrollLeft > 8,
      right: scrollLeft < scrollWidth - clientWidth - 8,
    });
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !open) return;
    const onScroll = () => updateScrollFade(container);
    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, [open]);

  const handleClaim = () => {
    if (!canClaim) return;
    tg?.haptic.light();
    claimDailyBonus.mutate();
  };

  if (!open) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        className="modal-overlay active"
        {...modalBackdrop}
        onClick={onClose}
      >
        <motion.div
          className="modal modal--large daily-bonus-modal-v2"
          {...modalPanel}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="modal-title">
              <i className="fas fa-gift" /> Ежедневные бонусы
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="modal-body">
            <div className="daily-bonus-v2-inner">
              <div className="daily-bonus-v2-header">
                <span className="daily-bonus-v2-streak">
                  <i className="fas fa-fire" /> Серия: <strong>{currentStreak}</strong>
                </span>
                {nextClaimAt && !canClaim && (
                  <span className="daily-bonus-v2-next">
                    <i className="fas fa-clock" /> {formatTimeUntil(nextClaimAt)}
                  </span>
                )}
              </div>

              <p className="daily-bonus-v2-hint">
                Заходите каждый день — награда растёт. Прокрутите в сторону, чтобы увидеть все дни.
              </p>

              <div className="daily-bonus-v2-scroll-wrap">
                <div className="daily-bonus-v2-fade daily-bonus-v2-fade--left" style={{ opacity: scrollFade.left ? 1 : 0 }} aria-hidden="true" />
                <div
                  ref={scrollRef}
                  className="daily-bonus-v2-track"
                  id="dailyBonusScrollContainer"
                >
                  {bonuses.map((bonus, index) => {
                    const isNext = canClaim && bonus.day_number === nextStreak;
                    const isClaimed = bonus.day_number < nextStreak;
                    return (
                      <div
                        key={bonus.day_number}
                        className={`daily-bonus-v2-pill ${isClaimed ? 'claimed' : ''} ${isNext ? 'next' : ''} ${!isClaimed && !isNext ? 'locked' : ''}`}
                        data-day={bonus.day_number}
                        data-index={index}
                      >
                        <div className="daily-bonus-v2-pill-day">День {bonus.day_number}</div>
                        <div className="daily-bonus-v2-pill-amount">
                          <span className="daily-bonus-v2-pill-value">{bonus.amount}</span>
                          <span className="daily-bonus-v2-pill-currency">DRG</span>
                        </div>
                        <div className="daily-bonus-v2-pill-status">
                          {isClaimed && <i className="fas fa-check-circle" title="Забран" />}
                          {isNext && <i className="fas fa-gift" title="Доступен" />}
                          {!isClaimed && !isNext && <i className="fas fa-lock" title="Заблокирован" />}
                        </div>
                        {bonus.is_final && <span className="daily-bonus-v2-pill-final">Финальный</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="daily-bonus-v2-fade daily-bonus-v2-fade--right" style={{ opacity: scrollFade.right ? 1 : 0 }} aria-hidden="true" />
              </div>
            </div>
          </div>
          <div className="modal-actions modal-actions--split">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Закрыть
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleClaim}
              disabled={!canClaim || claimDailyBonus.isPending}
            >
              <i className="fas fa-gift" /> Забрать бонус
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
