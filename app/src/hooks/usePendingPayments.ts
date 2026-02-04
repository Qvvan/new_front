import { useEffect } from 'react';
import { userApi, paymentApi } from '../core/api/endpoints';
import { storage } from '../core/storage';
import { usePaymentBannerStore } from '../shared/ui/PaymentBanner';

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
        const pending = await paymentApi.getPending(userId);

        for (const p of pending) {
          const url = p.confirmation_url ?? p.receipt_link ?? p.url ?? p.payment_url;
          await storage.addPendingPayment({ ...p, payment_url: url, url: url ?? '', confirmation_url: url ?? '' });
        }

        if (pending.length > 0 && !cancelled) {
          const sorted = [...pending].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
          const oldest = sorted[0];
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
