import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useModalsStore } from '../../app/modalsStore';
import { useTelegram } from '../../core/telegram/hooks';
import { subscriptionApi } from '../../core/api/endpoints';
import { formatDate, daysBetween, pluralize } from '../../core/utils';
import { modalBackdrop, modalPanel } from '../../shared/motion/variants';

const SUPPORT_URL = 'https://t.me/SkyDragonSupport';

type Sub = {
  subscription_id?: number;
  id?: string;
  end_date?: string;
  status?: string;
  auto_renewal?: boolean;
  service_name?: string;
  service_id?: number;
};

/* ───── FAQ ───── */

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

/* ───── Определение устройства ───── */

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return '';
}

/* ───── Статус подписки ───── */

function getStatusLabel(status?: string): string {
  switch (status) {
    case 'active': return '✅ Активна';
    case 'trial': return '🎁 Пробный период';
    case 'expired': return '❌ Истекла';
    default: return status ?? 'Неизвестно';
  }
}

/* ───── Формирование текста для Telegram ───── */

function buildSupportText(sub?: Sub): string {
  const device = getDeviceName();

  let text = '🐉 SkyDragon VPN — Обращение в поддержку\n\n';

  if (sub) {
    const name = sub.service_name || `Подписка #${sub.subscription_id ?? sub.id ?? ''}`;
    const status = getStatusLabel(sub.status);
    const endDate = sub.end_date ? formatDate(sub.end_date, 'long') : 'Не указана';
    const days = sub.end_date ? daysBetween(sub.end_date) : 0;

    let daysHint: string;
    if (days > 0) {
      daysHint = `(осталось ${days} ${pluralize(days, ['день', 'дня', 'дней'])})`;
    } else if (days === 0) {
      daysHint = '(истекает сегодня)';
    } else {
      const abs = Math.abs(days);
      daysHint = `(истекла ${abs} ${pluralize(abs, ['день', 'дня', 'дней'])} назад)`;
    }

    const autoRenewal = sub.auto_renewal ? '✅ Включено' : '❌ Выключено';

    text += '📋 Информация о подписке:\n';
    text += `▸ Тариф: ${name}\n`;
    text += `▸ Статус: ${status}\n`;
    text += `▸ Действует до: ${endDate} ${daysHint}\n`;
    text += `▸ Автопродление: ${autoRenewal}\n\n`;
  }

  text += `📱 Устройство: ${device || '[укажите ваше устройство]'}\n\n`;
  text += '💬 Опишите ваш вопрос:\n';

  return text;
}

/* ───── Компонент ───── */

export function SupportModal() {
  const { support, closeSupport } = useModalsStore();
  const tg = useTelegram();
  const [view, setView] = useState<'main' | 'faq' | 'select-sub'>('main');
  const [faqId, setFaqId] = useState<string | null>(null);

  /* подписки (берутся из кэша React Query) */
  const { data: subsRes } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionApi.list(),
  });
  const subscriptions = useMemo<Sub[]>(() => {
    if (Array.isArray(subsRes)) return subsRes as Sub[];
    return ((subsRes as { subscriptions?: Sub[] })?.subscriptions ?? []) as Sub[];
  }, [subsRes]);

  /* ── навигация ── */

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

  const handleClose = useCallback(() => {
    setView('main');
    setFaqId(null);
    closeSupport();
  }, [closeSupport]);

  /* ── открытие ссылки с предзаполненным текстом ── */

  const openSupportLink = useCallback((text: string) => {
    const url = `${SUPPORT_URL}?text=${encodeURIComponent(text)}`;
    tg?.openTelegramLink?.(url) ?? tg?.openLink?.(url) ?? window.open(url, '_blank');
    handleClose();
  }, [tg, handleClose]);

  /* ── кнопка «Написать в поддержку» ── */

  const contactSupport = useCallback(() => {
    tg?.haptic.light();

    if (subscriptions.length === 0) {
      // нет подписок — общий вопрос
      openSupportLink(buildSupportText());
    } else if (subscriptions.length === 1) {
      // одна подписка — сразу предзаполняем
      openSupportLink(buildSupportText(subscriptions[0]));
    } else {
      // несколько подписок — даём выбор
      setView('select-sub');
    }
  }, [tg, subscriptions, openSupportLink]);

  /* ── выбор конкретной подписки (или «другое») ── */

  const selectSubscription = useCallback((sub?: Sub) => {
    tg?.haptic.light();
    openSupportLink(buildSupportText(sub));
  }, [tg, openSupportLink]);

  /* ── рендер ── */

  if (!support) return null;

  const faqContent = faqId ? FAQ_CONTENT[faqId] : null;

  const viewTitle =
    view === 'faq' && faqContent
      ? faqContent.title
      : view === 'select-sub'
        ? 'Выберите подписку'
        : 'Поддержка';

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
          {/* ── шапка ── */}
          <div className="modal-header">
            <div className="modal-title">
              <i className={`fas ${view === 'select-sub' ? 'fa-list-alt' : 'fa-headset'}`} />
              {viewTitle}
            </div>
            <button type="button" className="modal-close" onClick={handleClose} aria-label="Закрыть">
              <i className="fas fa-times" />
            </button>
          </div>

          {/* ── тело ── */}
          <div className="modal-body">
            <AnimatePresence mode="wait">

              {/* — главный экран (FAQ) — */}
              {view === 'main' && (
                <motion.div
                  key="main"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
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
              )}

              {/* — детали FAQ — */}
              {view === 'faq' && faqContent && (
                <motion.div
                  key="faq"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
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
              )}

              {/* — выбор подписки (2+ подписок) — */}
              {view === 'select-sub' && (
                <motion.div
                  key="select-sub"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="faq-list"
                >
                  <p className="support-select-hint">
                    📌 По какой подписке у вас вопрос?
                  </p>

                  {subscriptions.map(sub => {
                    const subId = sub.subscription_id ?? Number(sub.id);
                    const name = sub.service_name || `Подписка #${subId}`;
                    const days = daysBetween(sub.end_date ?? '');
                    const isExpired = days <= 0;
                    return (
                      <div
                        key={subId}
                        className="faq-item"
                        onClick={() => selectSubscription(sub)}
                        role="button"
                        tabIndex={0}
                      >
                        <i
                          className={`fas ${isExpired ? 'fa-times-circle' : 'fa-shield-alt'}`}
                          style={{ color: isExpired ? 'var(--danger, #ef4444)' : 'var(--primary, #6366f1)' }}
                        />
                        <span>
                          {name}
                          <small className="support-sub-meta">
                            {isExpired
                              ? `Истекла ${Math.abs(days)} ${pluralize(Math.abs(days), ['день', 'дня', 'дней'])} назад`
                              : `Активна · ${days} ${pluralize(days, ['день', 'дня', 'дней'])}`}
                          </small>
                        </span>
                        <i className="fas fa-chevron-right" />
                      </div>
                    );
                  })}

                  <div
                    className="faq-item"
                    onClick={() => selectSubscription()}
                    role="button"
                    tabIndex={0}
                  >
                    <i className="fas fa-question-circle" style={{ color: 'var(--text-secondary, #9ca3af)' }} />
                    <span>Другой вопрос</span>
                    <i className="fas fa-chevron-right" />
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* ── кнопки ── */}
          <div className="modal-actions">
            {view === 'faq' || view === 'select-sub' ? (
              <button type="button" className="btn btn-secondary" onClick={goBack}>
                <i className="fas fa-arrow-left" /> Назад
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Закрыть
              </button>
            )}

            {view !== 'select-sub' && (
              <button type="button" className="btn btn-primary" onClick={contactSupport}>
                <i className="fas fa-paper-plane" /> Написать в поддержку
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
