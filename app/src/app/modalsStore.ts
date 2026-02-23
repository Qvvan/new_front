import { create } from 'zustand';

interface ModalsState {
  instructions: boolean;
  support: boolean;
  serviceSelector: { open: boolean; mode: 'buy' | 'renew' | 'gift'; subscriptionId?: number } | null;
  dailyBonusOpen: boolean;
  currencyOpen: boolean;
  historyOpen: boolean;
  openInstructions: () => void;
  closeInstructions: () => void;
  openSupport: () => void;
  closeSupport: () => void;
  openServiceSelector: (mode: 'buy' | 'renew' | 'gift', subscriptionId?: number) => void;
  closeServiceSelector: () => void;
  openDailyBonus: () => void;
  closeDailyBonus: () => void;
  openCurrency: () => void;
  closeCurrency: () => void;
  openHistory: () => void;
  closeHistory: () => void;
}

export const useModalsStore = create<ModalsState>(set => ({
  instructions: false,
  support: false,
  serviceSelector: null,
  dailyBonusOpen: false,
  currencyOpen: false,
  historyOpen: false,
  openInstructions: () => set({ instructions: true }),
  closeInstructions: () => set({ instructions: false }),
  openSupport: () => set({ support: true }),
  closeSupport: () => set({ support: false }),
  openServiceSelector: (mode, subscriptionId) => set({ serviceSelector: { open: true, mode, subscriptionId } }),
  closeServiceSelector: () => set({ serviceSelector: null }),
  openDailyBonus: () => set({ dailyBonusOpen: true }),
  closeDailyBonus: () => set({ dailyBonusOpen: false }),
  openCurrency: () => set({ currencyOpen: true }),
  closeCurrency: () => set({ currencyOpen: false }),
  openHistory: () => set({ historyOpen: true }),
  closeHistory: () => set({ historyOpen: false }),
}));
