import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userApi, paymentApi, currencyApi, giftApi, servicesApi } from '../../core/api/endpoints';
import { useModal } from '../../shared/ui/Modal';
import { useToast } from '../../shared/ui/Toast';
import { useTelegram } from '../../core/telegram/hooks';
import { formatDate, formatPrice, formatDurationDays, copyToClipboard } from '../../core/utils';
import { TgsPlayer, ASSETS_GIFS } from '../../shared/ui/TgsPlayer';

type Action = { type: 'payment' | 'currency' | 'gift'; data: unknown; date: Date };

const HISTORY_TABS = [
  { id: 'all' as const, label: 'Все', icon: 'fas fa-list' },
  { id: 'daily' as const, label: 'Ежедневные', icon: 'fas fa-calendar-day' },
  { id: 'gifts' as const, label: 'Подарки', icon: 'fas fa-gift' },
  { id: 'payments' as const, label: 'Платежи', icon: 'fas fa-credit-card' },
  { id: 'promo' as const, label: 'Промокоды', icon: 'fas fa-ticket-alt' },
] as const;
type HistoryTabId = typeof HISTORY_TABS[number]['id'];

function formatDateLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const ds = d.toDateString();
  if (ds === today.toDateString()) return 'Сегодня';
  if (ds === yesterday.toDateString()) return 'Вчера';
  return formatDate(d, 'long');
}

export function PaymentsHistoryContent() {
  const modal = useModal();
  const toast = useToast();
  const tg = useTelegram();
  const [activeTab, setActiveTab] = useState<HistoryTabId>('all');

  const { data: user } = useQuery({ queryKey: ['user'], queryFn: () => userApi.getCurrentUser() });
  const userId = (user as { telegram_id?: number })?.telegram_id ?? (user as { user_id?: number })?.user_id;

  const { data: paymentsRes } = useQuery({
    queryKey: ['payments', userId],
    queryFn: () => paymentApi.list(userId!, { limit: 50, offset: 0 }),
    enabled: !!userId,
  });
  const payments = (paymentsRes as { payments?: unknown[] })?.payments ?? [];

  const { data: txRes } = useQuery({
    queryKey: ['currencyTx', userId],
    queryFn: () => currencyApi.getTransactions({ limit: 50, offset: 0 }),
    enabled: !!userId,
  });
  const transactions = (txRes as { transactions?: unknown[] })?.transactions ?? [];

  const { data: giftsList } = useQuery({
    queryKey: ['gifts', userId],
    queryFn: async () => {
      const [pending, sent] = await Promise.all([
        giftApi.getPending(userId!).catch(() => []),
        giftApi.getSent(userId!).catch(() => []),
      ]);
      return [...pending, ...sent];
    },
    enabled: !!userId,
  });

  const { data: servicesList } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesApi.list(),
  });
  const services = Array.isArray(servicesList) ? servicesList : (servicesList as { services?: unknown[] })?.services ?? [];
  const servicesTyped = services as { id?: number; service_id?: number; name?: string }[];
  const serviceMap = new Map(servicesTyped.map(s => [(s.service_id ?? s.id)!, s]));

  const allActions = useMemo(() => {
    const list: Action[] = [];
    (payments as { created_at?: string }[]).forEach(p => list.push({ type: 'payment', data: p, date: new Date(p.created_at ?? 0) }));
    (transactions as { created_at?: string }[]).forEach(t => list.push({ type: 'currency', data: t, date: new Date(t.created_at ?? 0) }));
    ((giftsList ?? []) as { created_at?: string }[]).forEach(g => list.push({ type: 'gift', data: g, date: new Date(g.created_at ?? 0) }));
    list.sort((a, b) => b.date.getTime() - a.date.getTime());
    return list;
  }, [payments, transactions, giftsList]);

  const filteredActions = useMemo(() => {
    if (activeTab === 'all') return allActions;
    if (activeTab === 'daily') {
      return allActions.filter(a => a.type === 'currency' && (a.data as { transaction_type?: string }).transaction_type === 'daily_bonus');
    }
    if (activeTab === 'gifts') return allActions.filter(a => a.type === 'gift');
    if (activeTab === 'payments') return allActions.filter(a => a.type === 'payment');
    if (activeTab === 'promo') {
      return allActions.filter(a => a.type === 'gift' && (a.data as { status?: string }).status === 'activated');
    }
    return allActions;
  }, [allActions, activeTab]);

  const byDate = useMemo(() => {
    const map = new Map<string, Action[]>();
    filteredActions.forEach(a => {
      const key = a.date.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [filteredActions]);

  const getServiceName = (p: { service_id?: number; service_name?: string; description?: string }) => {
    if (p.service_name) return p.service_name;
    const s = p.service_id ? serviceMap.get(p.service_id) : null;
    return (s as { name?: string })?.name ?? p.description?.split(' - ')[0] ?? 'VPN подписка';
  };

  const getServiceDuration = (p: { service_id?: number; service_duration?: string }) => {
    if (p.service_duration) return p.service_duration;
    const s = p.service_id ? serviceMap.get(p.service_id) : null;
    const days = (s as { duration_days?: number })?.duration_days;
    if (days != null) return formatDurationDays(days);
    return 'Неизвестно';
  };

  const showPaymentDetails = (payment: {
    id?: string; payment_id?: string; status?: string; service_id?: number; service_name?: string; service_duration?: string;
    service_price?: number; price?: number; amount?: number; created_at?: string; updated_at?: string; description?: string;
    confirmation_url?: string; payment_url?: string; receipt_link?: string;
  }) => {
    const receiptUrl = payment.confirmation_url ?? payment.payment_url ?? payment.receipt_link;
    const statusText = payment.status === 'pending' ? 'Ожидает оплаты' : payment.status === 'succeeded' ? 'Успешно оплачено' : 'Отменено';
    const statusClass = payment.status === 'pending' ? 'pending' : payment.status === 'succeeded' ? 'success' : 'canceled';
    const serviceName = getServiceName(payment);
    const serviceDuration = getServiceDuration(payment);
    const servicePrice = payment.service_price ?? payment.price ?? payment.amount ?? 0;
    const actualPrice = payment.price ?? payment.amount ?? 0;
    const hasDiscount = servicePrice > actualPrice && actualPrice > 0;
    const paymentId = payment.payment_id ?? payment.id;
    const formatId = (id: string | number | undefined) => {
      if (!id) return null;
      const s = String(id);
      return s.length > 16 ? `${s.slice(0, 16)}...` : s;
    };
    const createdAt = formatDate(payment.created_at ?? '', 'long');
    const updatedAt = payment.updated_at ? formatDate(payment.updated_at, 'long') : null;

    modal.show({
      title: 'Детали платежа',
      content: (
        <div className="payment-details">
          {paymentId != null && (
            <div className="payment-detail-item">
              <span className="detail-label">ID платежа</span>
              <span className="detail-value payment-id">{formatId(paymentId)}</span>
            </div>
          )}
          <div className="payment-detail-item">
            <span className="detail-label">Услуга</span>
            <span className="detail-value">{serviceName}</span>
          </div>
          <div className="payment-detail-item">
            <span className="detail-label">Период</span>
            <span className="detail-value">{serviceDuration}</span>
          </div>
          <div className="payment-detail-item">
            <span className="detail-label">Статус</span>
            <span className={`detail-value payment-status ${statusClass}`}>{statusText}</span>
          </div>
          {hasDiscount && (
            <>
              <div className="payment-detail-item">
                <span className="detail-label">Цена сервиса</span>
                <span className="detail-value original-price">{formatPrice(servicePrice)}</span>
              </div>
              <div className="payment-detail-item">
                <span className="detail-label">Скидка</span>
                <span className="detail-value discount-amount">-{formatPrice(servicePrice - actualPrice)}</span>
              </div>
            </>
          )}
          <div className="payment-detail-item">
            <span className="detail-label">{hasDiscount ? 'Итого заплачено' : 'Сумма'}</span>
            <span className="detail-value final-price">{formatPrice(actualPrice)}</span>
          </div>
          <div className="payment-detail-item">
            <span className="detail-label">Дата создания</span>
            <span className="detail-value">{createdAt}</span>
          </div>
          {updatedAt && updatedAt !== createdAt && (
            <div className="payment-detail-item">
              <span className="detail-label">Последнее обновление</span>
              <span className="detail-value">{updatedAt}</span>
            </div>
          )}
          {payment.description && (
            <div className="payment-detail-item">
              <span className="detail-label">Описание</span>
              <span className="detail-value">{payment.description}</span>
            </div>
          )}
        </div>
      ),
      buttons: [
        ...(payment.status === 'pending' ? [{
          id: 'continue', text: 'Продолжить оплату', type: 'primary' as const,
          handler: () => {
            const url = payment.confirmation_url ?? payment.payment_url;
            if (url) tg?.openLink?.(url);
            modal.hide();
          },
        }] : []),
        ...(payment.status === 'succeeded' && receiptUrl ? [{
          id: 'receipt', text: 'Перейти в чек', type: 'primary' as const,
          handler: () => {
            if (receiptUrl) tg?.openLink?.(receiptUrl);
            modal.hide();
          },
        }] : []),
        { id: 'close', text: 'Закрыть', action: 'close' as const },
      ],
    });
  };

  const showGiftDetails = (gift: {
    gift_id?: string; id?: string; gift_code?: string; status?: string; recipient_user_id?: number | null;
    recipient_name?: string | null;
    created_at?: string; activated_at?: string | null;
    message?: string | null;
    sender_display_name?: string | null;
    activated_by_user_id?: number | null;
    activated_by_me?: boolean;
    activated_by_name?: string | null;
    activated_by_fullname?: string | null;
    activated_by_username?: string | null;
  }) => {
    const statusText = gift.status === 'activated' ? 'Активирован' : gift.status === 'pending' ? 'Ожидает активации' : gift.status === 'canceled' ? 'Отменен' : 'Неизвестно';
    const handleCopyCode = async () => {
      if (!gift.gift_code) return;
      const ok = await copyToClipboard(gift.gift_code);
      if (ok) {
        toast.success('Код скопирован!');
        tg?.haptic?.light?.();
      } else toast.error('Не удалось скопировать');
    };

    const hasActivatorInfo = gift.activated_by_me === true ||
      gift.activated_by_user_id != null ||
      (gift.activated_by_name != null && gift.activated_by_name !== '') ||
      (gift.activated_by_fullname != null && gift.activated_by_fullname !== '') ||
      (gift.activated_by_username != null && gift.activated_by_username !== '');
    const isActivatorMe = gift.activated_by_me === true ||
      (userId != null && gift.activated_by_user_id != null && gift.activated_by_user_id === userId);
    const activatorDisplayName = gift.activated_by_name ?? gift.activated_by_fullname ?? gift.activated_by_username ?? (gift.activated_by_user_id != null ? `ID ${gift.activated_by_user_id}` : null);
    const activatorLabel = gift.status === 'activated' && hasActivatorInfo
      ? (isActivatorMe ? 'Вы активировали' : activatorDisplayName ? `Активировал: ${activatorDisplayName}` : null)
      : null;

    const recipientDisplay = (gift.recipient_name != null && gift.recipient_name !== '')
      ? gift.recipient_name
      : (gift.recipient_user_id != null ? `ID: ${gift.recipient_user_id}` : null);

    modal.show({
      title: 'Детали подарка',
      content: (
        <div className="payment-details">
          <div className="payment-detail-item">
            <span className="detail-label">Статус</span>
            <span className={`detail-value payment-status ${gift.status}`}>{statusText}</span>
          </div>
          {gift.gift_code && (
            <div className="payment-detail-item">
              <span className="detail-label">Код активации</span>
              <div className="gift-code-container">
                <span className="detail-value" id="gift-code-value">{gift.gift_code}</span>
                <button type="button" className="btn-copy-code" onClick={handleCopyCode}>
                  <i className="fas fa-copy" /> Копировать
                </button>
              </div>
            </div>
          )}
          {(gift.sender_display_name != null && gift.sender_display_name !== '') && (
            <div className="payment-detail-item">
              <span className="detail-label">Имя дарителя</span>
              <span className="detail-value">{gift.sender_display_name}</span>
            </div>
          )}
          {gift.message != null && gift.message !== '' && (
            <div className="payment-detail-item">
              <span className="detail-label">Сообщение</span>
              <span className="detail-value">{gift.message}</span>
            </div>
          )}
          {recipientDisplay != null && (
            <div className="payment-detail-item">
              <span className="detail-label">Получатель</span>
              <span className="detail-value">{recipientDisplay}</span>
            </div>
          )}
          {gift.activated_at && (
            <div className="payment-detail-item">
              <span className="detail-label">Дата активации</span>
              <span className="detail-value">{formatDate(gift.activated_at, 'long')}</span>
            </div>
          )}
          {activatorLabel != null && (
            <div className="payment-detail-item">
              <span className="detail-label">Кто активировал</span>
              <span className="detail-value">{activatorLabel}</span>
            </div>
          )}
          <div className="payment-detail-item">
            <span className="detail-label">Дата создания</span>
            <span className="detail-value">{formatDate(gift.created_at ?? '', 'long')}</span>
          </div>
        </div>
      ),
      buttons: [{ id: 'close', text: 'Закрыть', action: 'close' as const }],
    });
  };

  const showTxDetails = (tx: {
    amount?: number; transaction_type?: string; description?: string; created_at?: string;
    balance_before?: number; balance_after?: number;
  }) => {
    const typeMap: Record<string, string> = { daily_bonus: 'Ежедневный бонус', referral_bonus: 'Реферальный бонус', purchase: 'Покупка', refund: 'Возврат' };
    const typeText = typeMap[tx.transaction_type ?? ''] ?? tx.description ?? 'Транзакция';
    const amount = Number(tx.amount ?? 0);
    const isPositive = amount > 0;
    const isDailyBonus = tx.transaction_type === 'daily_bonus';
    const balanceBefore = tx.balance_before;
    const balanceAfter = tx.balance_after ?? 0;

    modal.show({
      title: isDailyBonus ? 'Ежедневный бонус' : 'Детали транзакции',
      content: (
        <div className="payment-details">
          <div className="payment-detail-item">
            <span className="detail-label">Тип</span>
            <span className="detail-value">{typeText}</span>
          </div>
          <div className="payment-detail-item">
            <span className="detail-label">{isDailyBonus ? 'Получено' : 'Сумма'}</span>
            <span className={`detail-value ${isPositive ? 'text-green' : 'text-yellow'}`}>
              {isPositive ? '+' : ''}{amount} DRG
            </span>
          </div>
          {balanceBefore != null && (
            <div className="payment-detail-item">
              <span className="detail-label">Баланс до</span>
              <span className="detail-value">{balanceBefore} DRG</span>
            </div>
          )}
          <div className="payment-detail-item">
            <span className="detail-label">Баланс после</span>
            <span className="detail-value text-green">{balanceAfter} DRG</span>
          </div>
          <div className="payment-detail-item">
            <span className="detail-label">{isDailyBonus ? 'Время получения' : 'Дата'}</span>
            <span className="detail-value">{formatDate(tx.created_at ?? '', 'long')}</span>
          </div>
          {tx.description && (
            <div className="payment-detail-item">
              <span className="detail-label">Описание</span>
              <span className="detail-value">{tx.description}</span>
            </div>
          )}
        </div>
      ),
      buttons: [{ id: 'close', text: 'Закрыть', action: 'close' as const }],
    });
  };

  const emptyMessages: Record<HistoryTabId, { title: string; text: string }> = {
    all: { title: 'Нет операций', text: 'История операций появится здесь' },
    daily: { title: 'Нет ежедневных бонусов', text: 'Заходите каждый день, чтобы получать бонусы' },
    gifts: { title: 'Нет подарков', text: 'Отправленные и полученные подарки появятся здесь' },
    payments: { title: 'Нет платежей', text: 'История платежей появится здесь' },
    promo: { title: 'Нет промокодов', text: 'Активированные промокоды появятся здесь' },
  };

  return (
    <>
      <div className="history-tabs-nav">
        {HISTORY_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            className={`history-tab-button ${activeTab === id ? 'active' : ''}`}
            onClick={() => { tg?.haptic?.light?.(); setActiveTab(id); }}
          >
            <i className={icon} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {filteredActions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <TgsPlayer src={`${ASSETS_GIFS}/empty-profiles.tgs`} fallbackIcon="fas fa-credit-card" width={80} height={80} />
          </div>
          <h3 className="empty-state-title">{emptyMessages[activeTab].title}</h3>
          <p className="empty-state-text">{emptyMessages[activeTab].text}</p>
        </div>
      ) : (
        [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([dateKey, actions]) => (
          <div key={dateKey} className="payment-date-group">
            <div className="payment-date-header">
              <h3 className="payment-date-title">{formatDateLabel(new Date(dateKey))}</h3>
            </div>
            <div className="payment-list">
              {actions.map((a, i) => {
                if (a.type === 'payment') {
                  const p = a.data as { id?: string; payment_id?: string; status?: string; service_name?: string; service_duration?: string; price?: number; amount?: number; created_at?: string };
                  const statusClass = p.status === 'pending' ? 'pending' : p.status === 'succeeded' ? 'success' : 'canceled';
                  return (
                    <div key={`p-${i}`} className={`payment-item ${statusClass}`} onClick={() => showPaymentDetails(p)} role="button" tabIndex={0}>
                      <div className="payment-item-icon"><i className={`fas ${p.status === 'pending' ? 'fa-clock' : p.status === 'succeeded' ? 'fa-check' : 'fa-times'}`} /></div>
                      <div className="payment-item-info">
                        <div className="payment-item-service">{getServiceName(p)}</div>
                        <div className="payment-item-meta">{formatDate(p.created_at ?? '', 'relative')}</div>
                      </div>
                      <div className="payment-item-amount">
                        <div className="payment-amount">{formatPrice(p.price ?? p.amount ?? 0)}</div>
                        <div className={`payment-status ${statusClass}`}>{p.status === 'pending' ? 'Ожидает' : p.status === 'succeeded' ? 'Оплачено' : 'Отменено'}</div>
                      </div>
                    </div>
                  );
                }
                if (a.type === 'currency') {
                  const tx = a.data as { transaction_id?: string; id?: string; amount?: number; transaction_type?: string; description?: string; created_at?: string };
                  const pos = Number(tx.amount) > 0;
                  return (
                    <div key={`c-${i}`} className={`payment-item currency-transaction ${pos ? 'success' : 'warning'}`} onClick={() => showTxDetails(tx)} role="button" tabIndex={0}>
                      <div className="payment-item-icon"><i className={`fas ${pos ? 'fa-plus-circle' : 'fa-minus-circle'}`} /></div>
                      <div className="payment-item-info">
                        <div className="payment-item-service">{tx.description ?? 'Транзакция'}</div>
                        <div className="payment-item-meta">{formatDate(tx.created_at ?? '', 'relative')}</div>
                      </div>
                      <div className="payment-item-amount"><div className={`payment-amount ${pos ? 'text-green' : 'text-yellow'}`}>{pos ? '+' : ''}{tx.amount} DRG</div></div>
                    </div>
                  );
                }
                const g = a.data as { gift_id?: string; id?: string; status?: string; gift_code?: string; created_at?: string };
                return (
                  <div key={`g-${i}`} className={`payment-item gift-item ${g.status === 'activated' ? 'success' : g.status === 'pending' ? 'pending' : 'canceled'}`} onClick={() => showGiftDetails(g)} role="button" tabIndex={0}>
                    <div className="payment-item-icon"><i className="fas fa-gift" /></div>
                    <div className="payment-item-info">
                      <div className="payment-item-service">Подарок</div>
                      <div className="payment-item-meta">{g.gift_code ?? ''} • {g.status === 'activated' ? 'Активирован' : g.status === 'pending' ? 'Ожидает' : 'Отменен'}</div>
                    </div>
                    <div className="payment-item-amount"><div className="payment-status">{g.status === 'activated' ? 'Активирован' : g.status === 'pending' ? 'Ожидает' : 'Отменен'}</div></div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </>
  );
}
