import { create } from "zustand";
import type { PublicUser } from "../types/api";

interface UserState {
  users: PublicUser[];
  setUsers: (users: PublicUser[]) => void;
}

export const useUserStore = create<UserState>((set) => ({
  users: [],
  setUsers: (users) => set({ users }),
}));

export default useUserStore;
