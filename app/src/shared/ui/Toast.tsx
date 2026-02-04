import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'copied';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<{
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  copied: (message?: string) => void;
} | null>(null);

let id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const next = id++;
    setList(prev => [...prev.slice(-4), { id: next, message, type }]);
    setTimeout(() => setList(l => l.filter(t => t.id !== next)), 3000);
  }, []);

  const api = useCallback(() => ({
    show,
    success: (m: string) => show(m, 'success'),
    error: (m: string) => show(m, 'error'),
    warning: (m: string) => show(m, 'warning'),
    copied: (m = 'Скопировано') => show(m, 'copied'),
  }), [show])();

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="toast-container" id="toastContainer">
          <AnimatePresence>
            {list.map(t => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`toast toast-${t.type}`}
              >
                {t.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { show: () => {}, success: () => {}, error: () => {}, warning: () => {}, copied: () => {} };
  return ctx;
}

export function ToastContainer() {
  return null;
}
