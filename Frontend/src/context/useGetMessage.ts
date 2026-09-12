import { useEffect, useState } from "react";
import axiosClient from "../utils/axiosConfig";
import { useConversationStore } from "../state/conversationStore";
import type { Message } from "../types/api";

interface MessagesResponse {
  messages: Message[];
}

interface UseGetMessageResult {
  loading: boolean;
  error: boolean;
  retry: () => void;
  messages: Message[];
}

const useGetMessage = (): UseGetMessageResult => {
  const selectedConversationId = useConversationStore(
    (state) => state.selectedConversation?._id
  );
  const messages = useConversationStore(
    (state) =>
      selectedConversationId
        ? state.messagesByConversation[selectedConversationId] ?? []
        : []
  );
  const replaceMessages = useConversationStore((state) => state.replaceMessages);
  const [state, setState] = useState({ loading: false, error: false, retryKey: 0 });

  useEffect(() => {
    const conversationId = selectedConversationId;
    if (!conversationId) {
      setState((current) => ({ ...current, loading: false, error: false }));
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const getMessages = async () => {
      setState((current) => ({ ...current, loading: true, error: false }));
      try {
        const response = await axiosClient.get<Message[] | MessagesResponse>(
          `/api/message/get/${conversationId}`,
          { signal: controller.signal }
        );
        if (cancelled) return;

        const data = response.data;
        replaceMessages(conversationId, Array.isArray(data) ? data : data.messages);
        setState((current) => ({ ...current, loading: false }));
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) {
          console.error("Failed to load messages", error);
          setState((current) => ({ ...current, loading: false, error: true }));
        }
      }
    };

    void getMessages();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [replaceMessages, selectedConversationId, state.retryKey]);

  return {
    loading: state.loading,
    error: state.error,
    retry: () => setState((current) => ({ ...current, retryKey: current.retryKey + 1 })),
    messages,
  };
};

export default useGetMessage;
