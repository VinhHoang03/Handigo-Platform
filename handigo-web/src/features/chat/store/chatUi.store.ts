import { create } from "zustand";

interface ChatUiState {
  activePopupCount: number;
  registerOpenPopup: () => void;
  unregisterOpenPopup: () => void;
}

export const useChatUiStore = create<ChatUiState>((set) => ({
  activePopupCount: 0,
  registerOpenPopup: () =>
    set((state) => ({ activePopupCount: state.activePopupCount + 1 })),
  unregisterOpenPopup: () =>
    set((state) => ({
      activePopupCount: Math.max(0, state.activePopupCount - 1),
    })),
}));
