import { useEffect } from 'react';
import { userApi, paymentApi, servicesApi, type PendingPaymentApiItem } from '../core/api/endpoints';
import { formatDurationDays } from '../core/utils';
import { storage } from '../core/storage';
import { usePaymentBannerStore } from '../shared/ui/PaymentBanner';

type ServiceItem = { id?: number; service_id?: number; name?: string; price?: number; duration_days?: number };

function enrichPaymentWithService(
  payment: PendingPaymentApiItem,
  services: ServiceItem[],
): PendingPaymentApiItem {
  const out = { ...payment };
  if (payment.service_name && (payment.price != null && payment.price > 0 || payment.amount != null && payment.amount > 0)) {
    return out;
  }
  const service = payment.service_id != null
    ? services.find(s => (s.service_id ?? s.id) === payment.service_id)
    : null;
  if (service) {
    out.service_name = out.service_name ?? service.name;
    out.service_duration = out.service_duration ?? (service.duration_days != null ? formatDurationDays(service.duration_days) : undefined);
    if ((out.price == null || out.price === 0) && (out.amount == null || out.amount === 0) && service.price != null) {
      out.price = service.price;
    }
    if (out.price == null && out.amount != null) out.price = out.amount;
    return out;
  }
  out.service_name = out.service_name ?? out.description?.split(' - ')[0] ?? 'VPN подписка';
  const price = out.price ?? out.amount;
  if ((out.price == null || out.price === 0) && (out.amount == null || out.amount === 0) && out.description) {
    const match = out.description.match(/(\d+)/);
    if (match) out.price = parseInt(match[1], 10);
  } else if (out.price == null && out.amount != null) {
    out.price = out.amount;
  }
  return out;
}

export function usePendingPayments() {
  const showBanner = usePaymentBannerStore(s => s.show);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      await storage.clearPendingPayments();
      let userId: number | undefined;
      try {
        const user = await userApi.getCurrentUser();
        userId = (user as { telegram_id?: number }).telegram_id ?? (user as { user_id?: number }).user_id;
      } catch {
        return;
      }
      if (!userId || cancelled) return;

      try {
        const [pending, servicesRes] = await Promise.all([
          paymentApi.getPending(userId),
          servicesApi.list().catch(() => null),
        ]);

        const services: ServiceItem[] = Array.isArray(servicesRes)
          ? servicesRes
          : (servicesRes as { services?: unknown[] })?.services ?? [];

        for (const p of pending) {
          const url = p.confirmation_url ?? p.receipt_link ?? p.url ?? p.payment_url;
          await storage.addPendingPayment({ ...p, payment_url: url, url: url ?? '', confirmation_url: url ?? '' });
        }

        if (pending.length > 0 && !cancelled) {
          const sorted = [...pending].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
          const oldest = enrichPaymentWithService(sorted[0], services);
          const paymentUrl = oldest.confirmation_url ?? oldest.receipt_link ?? oldest.url ?? oldest.payment_url;
          const toShow = { ...oldest, payment_url: paymentUrl, url: paymentUrl ?? '', confirmation_url: paymentUrl ?? '', status: 'pending' as const };
          if (toShow.payment_url || toShow.url) showBanner(toShow);
        }
      } catch {
        await storage.clearPendingPayments();
      }
    }

    check();
    return () => { cancelled = true; };
  }, [showBanner]);
}
