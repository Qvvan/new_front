import { create } from 'zustand';
import type { StoryItem } from '../../core/api/endpoints';

interface StoriesState {
  stories: StoryItem[];
  isOpen: boolean;
  currentIndex: number;
  hasUnviewed: boolean;
  unviewedCount: number;

  setStories: (stories: StoryItem[]) => void;
  open: (index?: number) => void;
  close: () => void;
  next: () => boolean;
  prev: () => boolean;
  goTo: (index: number) => void;
  markViewed: (id: number) => void;
  setHasUnviewed: (has: boolean, count?: number) => void;
}

export const useStoriesStore = create<StoriesState>((set, get) => ({
  stories: [],
  isOpen: false,
  currentIndex: 0,
  hasUnviewed: false,
  unviewedCount: 0,

  setStories: (stories) => {
    // Chronological order: oldest (left) → newest (right)
    const sorted = [...stories].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    set({ stories: sorted });
  },

  open: (index = 0) => set({ isOpen: true, currentIndex: index }),

  close: () => set({ isOpen: false }),

  next: () => {
    const { currentIndex, stories } = get();
    if (currentIndex < stories.length - 1) {
      set({ currentIndex: currentIndex + 1 });
      return true;
    }
    set({ isOpen: false });
    return false;
  },

  prev: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
      return true;
    }
    return false;
  },

  goTo: (index) => {
    const { stories } = get();
    if (index >= 0 && index < stories.length) {
      set({ currentIndex: index });
    }
  },

  markViewed: (id) =>
    set((state) => {
      const newCount = Math.max(0, state.unviewedCount - 1);
      return {
        stories: state.stories.map((s) => (s.id === id ? { ...s, is_viewed: true } : s)),
        unviewedCount: newCount,
        hasUnviewed: newCount > 0,
      };
    }),

  setHasUnviewed: (has, count = 0) => set({ hasUnviewed: has, unviewedCount: count }),
}));
