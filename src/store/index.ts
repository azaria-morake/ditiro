import { create } from 'zustand';

interface AppState {
  sidebarOpen: boolean;
  activeChatId: string | null;
  setSidebarOpen: (isOpen: boolean) => void;
  setActiveChatId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  activeChatId: null,
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
  setActiveChatId: (id) => set({ activeChatId: id }),
}));
