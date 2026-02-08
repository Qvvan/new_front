import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { currencyApi } from '../../core/api/endpoints';
import { modalBackdrop, modalPanel } from '../../shared/motion/variants';

interface CurrencyModalProps {
  open: boolean;
  onClose: () => void;
}

type BalanceRes = {
  balance?: number | string;
  total_earned?: number | string;
  total_spent?: number | string;
  currency_name?: string;
  currency_code?: string;
};

export function CurrencyModal({ open, onClose }: CurrencyModalProps) {
  const { data: balanceData } = useQuery({
    queryKey: ['currencyBalance'],
    queryFn: () => currencyApi.getBalance() as Promise<BalanceRes>,
    enabled: open,
  });

  const balance = (balanceData ?? {}) as BalanceRes;
  const totalEarned = balance.total_earned ?? '0';
  const totalSpent = balance.total_spent ?? '0';
  const currencyName = balance.currency_name ?? 'Dragon Coins';
  const currencyCode = balance.currency_code ?? 'DRG';

  const content = (
    <AnimatePresence>
      {open && (
      <motion.div
        className="modal-overlay active"
        {...modalBackdrop}
        onClick={onClose}
      >
        <motion.div
          className="modal"
          {...modalPanel}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="modal-title">
              <i className="fas fa-coins" /> {currencyCode}
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="modal-body">
            <div className="currency-info-modal-content">
              <div className="currency-info-header">
                <div className="currency-icon-large">
                  <i className="fas fa-coins" />
                </div>
                <div className="currency-name">{currencyName}</div>
                <div className="currency-code">{currencyCode}</div>
              </div>

              <div className="currency-stats">
                <div className="currency-stat-item">
                  <div className="stat-icon earned">
                    <i className="fas fa-arrow-up" />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Всего заработано</div>
                    <div className="stat-value">
                      {Number(totalEarned).toFixed(0)} {currencyCode}
                    </div>
                  </div>
                </div>
                <div className="currency-stat-item">
                  <div className="stat-icon spent">
                    <i className="fas fa-arrow-down" />
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">Всего потрачено</div>
                    <div className="stat-value">
                      {Number(totalSpent).toFixed(0)} {currencyCode}
                    </div>
                  </div>
                </div>
              </div>

              <div className="currency-info-description">
                <div className="info-section">
                  <p>
                    <i className="fas fa-info-circle" />
                    Зарабатывайте {currencyCode} за ежедневные бонусы и приглашение друзей.
                    В будущем можно будет использовать для покупки подписок.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>
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
