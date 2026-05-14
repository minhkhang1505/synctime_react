import { create } from 'zustand';

interface UIState {
  isCreateGroupOpen: boolean;
  isJoinGroupOpen: boolean;
  setCreateGroupOpen: (open: boolean) => void;
  setJoinGroupOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCreateGroupOpen: false,
  isJoinGroupOpen: false,
  setCreateGroupOpen: (open) => set({ isCreateGroupOpen: open }),
  setJoinGroupOpen: (open) => set({ isJoinGroupOpen: open }),
}));
