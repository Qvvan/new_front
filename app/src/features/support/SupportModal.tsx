import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalsStore } from '../../app/modalsStore';
import { useTelegram } from '../../core/telegram/hooks';
import { modalBackdrop, modalPanel } from '../../shared/motion/variants';

const SUPPORT_URL = 'https://t.me/SkyDragonSupport';

const FAQ_ITEMS: { id: string; icon: string; title: string }[] = [
  { id: 'connection', icon: 'fas fa-wifi', title: 'Проблемы с подключением' },
  { id: 'speed', icon: 'fas fa-tachometer-alt', title: 'Низкая скорость' },
  { id: 'setup', icon: 'fas fa-cog', title: 'Настройка приложения' },
  { id: 'billing', icon: 'fas fa-credit-card', title: 'Вопросы по оплате' },
];

const FAQ_CONTENT: Record<string, { title: string; steps: string[] }> = {
  connection: {
    title: 'Проблемы с подключением',
    steps: [
      'Проверьте интернет соединение',
      'Перезапустите VPN приложение',
      'Попробуйте другой сервер',
      'Проверьте настройки брандмауэра',
    ],
  },
  speed: {
    title: 'Низкая скорость',
    steps: [
      'Выберите ближайший сервер',
      'Смените протокол',
      'Закройте лишние приложения',
      'Проверьте ограничения провайдера',
    ],
  },
  setup: {
    title: 'Настройка приложения',
    steps: [
      'Скачайте приложение из официального магазина',
      'Активируйте профиль через инструкции',
      'Нажмите подключиться',
      'Разрешите VPN соединение',
    ],
  },
  billing: {
    title: 'Вопросы по оплате',
    steps: [
      'Платежи обрабатываются автоматически',
      'При проблемах обратитесь в поддержку',
      'Возврат возможен в течение 7 дней',
      'Проверьте историю платежей в приложении',
    ],
  },
};

export function SupportModal() {
  const { support, closeSupport } = useModalsStore();
  const tg = useTelegram();
  const [view, setView] = useState<'main' | 'faq'>('main');
  const [faqId, setFaqId] = useState<string | null>(null);

  const openFaq = useCallback((id: string) => {
    tg?.haptic.light();
    setFaqId(id);
    setView('faq');
  }, [tg]);

  const goBack = useCallback(() => {
    tg?.haptic.light();
    setView('main');
    setFaqId(null);
  }, [tg]);

  const contactSupport = useCallback(() => {
    tg?.haptic.light();
    tg?.openTelegramLink?.(SUPPORT_URL) ?? tg?.openLink?.(SUPPORT_URL) ?? window.open(SUPPORT_URL, '_blank');
    closeSupport();
  }, [tg, closeSupport]);

  const handleClose = useCallback(() => {
    setView('main');
    setFaqId(null);
    closeSupport();
  }, [closeSupport]);

  if (!support) return null;

  const faqContent = faqId ? FAQ_CONTENT[faqId] : null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay active"
        {...modalBackdrop}
        onClick={handleClose}
      >
        <motion.div
          className="modal modal-support"
          {...modalPanel}
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="modal-title">
              <i className="fas fa-headset" />
              {view === 'faq' && faqContent ? faqContent.title : 'Поддержка'}
            </div>
            <button type="button" className="modal-close" onClick={handleClose} aria-label="Закрыть">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="modal-body">
            <AnimatePresence mode="wait">
              {view === 'main' ? (
                <motion.div
                  key="main"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="faq-list"
                >
                  {FAQ_ITEMS.map(item => (
                    <div
                      key={item.id}
                      className="faq-item"
                      onClick={() => openFaq(item.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <i className={item.icon} />
                      <span>{item.title}</span>
                      <i className="fas fa-chevron-right" />
                    </div>
                  ))}
                </motion.div>
              ) : faqContent ? (
                <motion.div
                  key="faq"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="faq-content"
                >
                  <div className="faq-steps">
                    {faqContent.steps.map((step, i) => (
                      <div key={i} className="faq-step">
                        <i className="fas fa-check-circle" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="modal-actions">
            {view === 'faq' ? (
              <button type="button" className="btn btn-secondary" onClick={goBack}>
                <i className="fas fa-arrow-left" /> Назад
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Закрыть
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={contactSupport}>
              <i className="fas fa-paper-plane" /> Написать в поддержку
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
