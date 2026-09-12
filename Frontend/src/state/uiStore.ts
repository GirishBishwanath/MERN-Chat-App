import { create } from "zustand";

interface UiState {
  searchQuery: string;
  setSearchQuery: (searchQuery: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));

export default useUiStore;
