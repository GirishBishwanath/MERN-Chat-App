import { create } from "zustand";
import type { Message, PublicUser } from "../types/api";

export interface ConversationState {
  selectedConversation: PublicUser | null;
  messagesByConversation: Record<string, Message[]>;
  setSelectedConversation: (conversation: PublicUser | null) => void;
  mergeMessages: (conversationId: string, messages: Message[]) => void;
  appendMessage: (conversationId: string, message: Message) => void;
  clearMessages: (conversationId: string) => void;
}

const mergeUniqueMessages = (
  currentMessages: Message[],
  incomingMessages: Message[]
): Message[] => {
  const messagesById = new Map<string, Message>();

  for (const message of currentMessages) {
    messagesById.set(message._id, message);
  }

  for (const message of incomingMessages) {
    messagesById.set(message._id, message);
  }

  return Array.from(messagesById.values()).sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
};

export const useConversationStore = create<ConversationState>((set) => ({
  selectedConversation: null,
  messagesByConversation: {},

  setSelectedConversation: (conversation) =>
    set({ selectedConversation: conversation }),

  mergeMessages: (conversationId, messages) =>
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationId] ?? [];

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: mergeUniqueMessages(currentMessages, messages),
        },
      };
    }),

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
