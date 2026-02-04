import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { modalBackdrop, modalPanel } from '../motion/variants';

interface ModalOptions {
  title: string;
  content: ReactNode;
  buttons?: { id: string; text: string; type?: 'primary' | 'secondary'; action?: 'close' | 'cancel' | 'confirm'; handler?: () => void | Promise<void> }[];
  onConfirm?: () => void;
  onCancel?: () => void;
}

const ModalContext = createContext<{
  show: (opts: ModalOptions) => void;
  hide: () => void;
  showConfirm: (title: string, message: string) => Promise<boolean>;
} | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ModalOptions | null>(null);
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const show = useCallback((o: ModalOptions) => setOpts(o), []);
  const hide = useCallback(() => { setOpts(null); confirmResolveRef.current = null; }, []);

  const showConfirm = useCallback((title: string, message: string) => {
    return new Promise<boolean>(resolve => {
      confirmResolveRef.current = resolve;
      setOpts({
        title,
        content: <p style={{ whiteSpace: 'pre-wrap' }}>{message}</p>,
        buttons: [
          { id: 'cancel', text: 'Отмена', action: 'cancel' },
          { id: 'ok', text: 'OK', type: 'primary', action: 'confirm' },
        ],
        onCancel: () => { confirmResolveRef.current?.(false); hide(); },
        onConfirm: () => { confirmResolveRef.current?.(true); hide(); },
      });
    });
  }, [hide]);

  const handleButton = useCallback(async (b: NonNullable<ModalOptions['buttons']>[0]) => {
    if (b.action === 'close' || b.action === 'cancel') {
      opts?.onCancel?.();
      hide();
      return;
    }
    if (b.action === 'confirm') {
      opts?.onConfirm?.();
      hide();
      return;
    }
    if (b.handler) {
      await b.handler();
    }
  }, [opts, hide]);

  const value = { show, hide, showConfirm };

  return (
    <ModalContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {opts && (
            <motion.div
              className="modal-overlay active"
              {...modalBackdrop}
              onClick={() => handleButton({ id: 'close', text: '', action: 'close' })}
            >
              <motion.div
                className="modal"
                {...modalPanel}
                onClick={e => e.stopPropagation()}
              >
                <div className="modal-header">
                  <div className="modal-title">{opts.title}</div>
                  <button type="button" className="modal-close" onClick={hide} aria-label="Закрыть">×</button>
                </div>
                <div className="modal-body">{opts.content}</div>
                {opts.buttons?.length ? (
                  <div className="modal-actions">
                    {opts.buttons.map(b => (
                      <button
                        key={b.id}
                        type="button"
                        className={`btn ${b.type === 'primary' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleButton(b)}
                      >
                        {b.text}
                      </button>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) return { show: () => {}, hide: () => {}, showConfirm: async () => false };
  return ctx;
}
