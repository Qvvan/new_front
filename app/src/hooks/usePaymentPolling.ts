import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { paymentApi, userApi } from '../core/api/endpoints';
import { clearApiCache } from '../core/api/client';
import { usePaymentBannerStore } from '../shared/ui/PaymentBanner';

export interface SuccessfulPayment {
  id: string;
  amount?: number;
  price?: number;
  service_name?: string;
  /** 'buy' | 'renew' | 'gift' — determines overlay text and post-dismiss action */
  paymentType?: 'buy' | 'renew' | 'gift';
}

/** Matches the actual API history response shape */
type HistoryPayment = {
  id?: string;
  payment_id?: number | string;
  payment_type?: string;
  status?: string;
  created_at?: string;
  amount?: number;
  price?: number;
  service_name?: string;
  description?: string;
};

/** Convert backend payment_type to our UI mode */
function apiTypeToMode(type?: string): 'buy' | 'renew' | 'gift' | undefined {
  if (type === 'renewal') return 'renew';
  if (type === 'subscription') return 'buy';
  if (type === 'gift') return 'gift';
  return undefined;
}

/**
 * Polls backend every 5s while there is a pending payment in the banner.
 * - Pauses when the app is in background (document.hidden).
 * - Resumes when the user comes back.
 * - Detects when the payment is no longer pending and checks if it succeeded
 *   via the payment history endpoint (paymentApi.list).
 * - Returns the successful payment info for the overlay.
 * - Stops polling when there are no more pending payments.
 * - Always invalidates subscription caches when a payment leaves pending.
 */
export function usePaymentPolling() {
  const payment = usePaymentBannerStore(s => s.payment);
  const hideBanner = usePaymentBannerStore(s => s.hide);
  const queryClient = useQueryClient();
  const [successPayment, setSuccessPayment] = useState<SuccessfulPayment | null>(null);
  const pollingInProgress = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const dismissSuccess = useCallback(() => {
    setSuccessPayment(null);
  }, []);

  useEffect(() => {
    // Only poll when there is a pending payment in the banner
    if (!payment || payment.status !== 'pending') {
      stopPolling();
      return;
    }

    // trackingId is a string (from PendingPayment.id, set by usePendingPayments or ServiceSelectorModal)
    const trackingId = payment.id;
    const trackingInfo: SuccessfulPayment = {
      id: trackingId,
      amount: payment.amount,
      price: payment.price,
      service_name: payment.service_name,
      paymentType: payment.mode ?? 'buy',
    };
    let cancelled = false;

    async function poll() {
      // Don't poll if app is in background — save device resources
      if (document.hidden) return;
      // Don't overlap polls
      if (pollingInProgress.current) return;
      pollingInProgress.current = true;

      try {
        // Clear API response cache so we get fresh data
        clearApiCache('/pending');

        let userId: number | undefined;
        try {
          const user = await userApi.getCurrentUser();
          userId = (user as { telegram_id?: number }).telegram_id
            ?? (user as { user_id?: number }).user_id;
        } catch {
          return;
        }
        if (!userId || cancelled) return;

        const pending = await paymentApi.getPending(userId);
        if (cancelled) return;

        // Match using payment_id (number from API) compared with our string trackingId
        const stillPending = pending.some(p =>
          String(p.payment_id ?? p.id ?? '') === trackingId,
        );

        if (!stillPending) {
          // Payment no longer in pending list.
          // Always invalidate subscription & user caches so fresh data loads.
          clearApiCache('/subscription/subscriptions/user');
          clearApiCache('/history');
          queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
          queryClient.invalidateQueries({ queryKey: ['user'] });

          // Determine if payment succeeded via payment history
          let succeeded = false;
          try {
            const historyRes = await paymentApi.list(userId, { limit: 10 });
            const payments = ((historyRes as { payments?: unknown[] })?.payments ?? []) as HistoryPayment[];

            if (!cancelled) {
              // Try to find our specific payment by ID (compare as strings)
              const found = payments.find(
                p => String(p.payment_id ?? p.id ?? '') === trackingId,
              );

              if (found) {
                succeeded = ['succeeded', 'success', 'paid'].includes(found.status ?? '');
                if (succeeded) {
                  trackingInfo.price = found.amount ?? found.price ?? trackingInfo.price;
                  trackingInfo.service_name = found.service_name ?? trackingInfo.service_name;
                  // Use payment_type from history if we don't have mode from the banner
                  if (!trackingInfo.paymentType || trackingInfo.paymentType === 'buy') {
                    trackingInfo.paymentType = apiTypeToMode(found.payment_type) ?? trackingInfo.paymentType;
                  }
                }
              } else {
                // ID not found (could be a temp ID) — check if the most recent
                // payment was successful and created within the last 10 minutes
                const recent = payments[0];
                if (recent?.status && ['succeeded', 'success', 'paid'].includes(recent.status)) {
                  const createdAt = new Date(recent.created_at ?? 0).getTime();
                  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
                  if (createdAt > tenMinutesAgo) {
                    succeeded = true;
                    trackingInfo.price = recent.amount ?? recent.price ?? trackingInfo.price;
                    trackingInfo.service_name = recent.service_name ?? trackingInfo.service_name;
                    trackingInfo.paymentType = apiTypeToMode(recent.payment_type) ?? trackingInfo.paymentType;
                  }
                }
              }
            }
          } catch {
            // Could not fetch history — we still hide the banner below
          }

          if (cancelled) return;

          if (succeeded) {
            setSuccessPayment({ ...trackingInfo });
          }

          // If there are still other pending payments, show the next one
          if (pending.length > 0) {
            const next = pending[0];
            const nextUrl = next.confirmation_url ?? next.payment_url ?? next.url;
            const nextId = String(next.payment_id ?? next.id ?? '');
            usePaymentBannerStore.getState().show({
              ...next,
              id: nextId,
              status: 'pending',
              payment_url: nextUrl,
              url: nextUrl ?? '',
              confirmation_url: nextUrl ?? '',
              mode: apiTypeToMode(next.payment_type),
            });
          } else {
            hideBanner();
          }
          stopPolling();
        }
        // If still pending — do nothing, wait for next poll cycle
      } catch {
        // Silently ignore polling errors to avoid overloading
      } finally {
        pollingInProgress.current = false;
      }
    }

    // Poll every 5 seconds
    intervalRef.current = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [payment?.id, payment?.status, stopPolling, hideBanner, queryClient]);

  return { successPayment, dismissSuccess };
}
