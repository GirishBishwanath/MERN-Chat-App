import { create } from "zustand";
import type { Message, PublicUser } from "../types/api";

export interface ConversationState {
  selectedConversation: PublicUser | null;
  messagesByConversation: Record<string, Message[]>;
  setSelectedConversation: (conversation: PublicUser | null) => void;
  replaceMessages: (conversationId: string, messages: Message[]) => void;
  appendMessage: (conversationId: string, message: Message) => void;
  clearMessages: (conversationId: string) => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  selectedConversation: null,
  messagesByConversation: {},

  setSelectedConversation: (conversation) =>
    set({ selectedConversation: conversation }),

  replaceMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: messages,
      },
    })),

  appendMessage: (conversationId, message) =>
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationId] ?? [];
      if (currentMessages.some((current) => current._id === message._id)) {
        return state;
      }

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...currentMessages, message],
        },
      };
    }),

  clearMessages: (conversationId) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [],
      },
    })),
}));

export default useConversationStore;
