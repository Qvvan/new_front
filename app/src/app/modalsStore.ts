import { create } from 'zustand';

interface ModalsState {
  instructions: boolean;
  support: boolean;
  serviceSelector: { open: boolean; mode: 'buy' | 'renew' | 'gift'; subscriptionId?: number } | null;
  openInstructions: () => void;
  closeInstructions: () => void;
  openSupport: () => void;
  closeSupport: () => void;
  openServiceSelector: (mode: 'buy' | 'renew' | 'gift', subscriptionId?: number) => void;
  closeServiceSelector: () => void;
}

export const useModalsStore = create<ModalsState>(set => ({
  instructions: false,
  support: false,
  serviceSelector: null,
  openInstructions: () => set({ instructions: true }),
  closeInstructions: () => set({ instructions: false }),
  openSupport: () => set({ support: true }),
  closeSupport: () => set({ support: false }),
  openServiceSelector: (mode, subscriptionId) => set({ serviceSelector: { open: true, mode, subscriptionId } }),
  closeServiceSelector: () => set({ serviceSelector: null }),
}));
