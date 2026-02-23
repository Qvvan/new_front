import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTelegram } from '../../core/telegram/hooks';
import { PaymentsHistoryContent } from '../../features/payments/PaymentsHistoryContent';
import { modalBackdrop, modalPanel } from '../motion/variants';

export interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
}

export function HistoryModal({ open, onClose }: HistoryModalProps) {
  const tg = useTelegram();

  const handleClose = () => {
    tg?.haptic?.light?.();
    onClose();
  };

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="history-modal-overlay"
          {...modalBackdrop}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={handleClose}
        >
          <motion.div
            className="history-modal-panel"
            {...modalPanel}
            onClick={e => e.stopPropagation()}
          >
            <div className="history-modal-header">
              <h2 className="history-modal-title">История операций</h2>
              <button
                type="button"
                className="history-modal-close"
                onClick={handleClose}
                aria-label="Закрыть"
              >
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="history-modal-body">
              <PaymentsHistoryContent />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
