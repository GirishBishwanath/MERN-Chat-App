import { create } from "zustand";
import type { Message, PublicUser } from "../types/api";

export interface ConversationState {
  selectedConversation: PublicUser | null;
  setSelectedConversation: (selectedConversation: PublicUser | null) => void;
  messages: Message[];
  setMessage: (messages: Message[]) => void;
}

const useConversation = create<ConversationState>((set) => ({
  selectedConversation: null,
  setSelectedConversation: (selectedConversation) =>
    set({ selectedConversation }),
  messages: [],
  setMessage: (messages) => set({ messages }),
}));

export default useConversation;
