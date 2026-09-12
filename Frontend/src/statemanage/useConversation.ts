import { create } from "zustand";
import type { Message, PublicUser } from "../types/api";

export type MessageUpdater = Message[] | ((currentMessages: Message[]) => Message[]);

export interface ConversationState {
  selectedConversation: PublicUser | null;
  setSelectedConversation: (selectedConversation: PublicUser | null) => void;
  messages: Message[];
  setMessage: (messages: MessageUpdater) => void;
}

const useConversation = create<ConversationState>((set) => ({
  selectedConversation: null,
  setSelectedConversation: (selectedConversation) =>
    set({ selectedConversation }),
  messages: [],
  setMessage: (messages) =>
    set((state) => ({
      messages:
        typeof messages === "function" ? messages(state.messages) : messages,
    })),
}));

export default useConversation;
