import { create } from 'zustand';
import type { DeepLinkAction } from './deeplink';

interface DeepLinkState {
  /** Pending deep link action waiting to be consumed by a screen/modal. */
  pending: DeepLinkAction | null;

  /** Set a pending action (called once on app init). */
  setPending: (action: DeepLinkAction | null) => void;

  /** Read and clear the pending action (one-time consumption). */
  consume: () => DeepLinkAction | null;
}

export const useDeepLinkStore = create<DeepLinkState>((set, get) => ({
  pending: null,

  setPending: (action) => set({ pending: action }),

  consume: () => {
    const { pending } = get();
    if (pending) set({ pending: null });
    return pending;
  },
}));
