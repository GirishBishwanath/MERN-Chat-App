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
  const selectedConversation = useConversationStore(
    (state) => state.selectedConversation
  );
  const messages = useConversationStore(
    (state) =>
      selectedConversation?._id
        ? state.messagesByConversation[selectedConversation._id] ?? []
        : []
  );
  const replaceMessages = useConversationStore((state) => state.replaceMessages);
  const clearMessages = useConversationStore((state) => state.clearMessages);
  const [state, setState] = useState({ loading: false, error: false, retryKey: 0 });

  useEffect(() => {
    const conversationId = selectedConversation?._id;
    if (!conversationId) {
      setState({ loading: false, error: false, retryKey: state.retryKey });
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
  }, [replaceMessages, selectedConversation?._id, state.retryKey]);

  return {
    loading: state.loading,
    error: state.error,
    retry: () => setState((current) => ({ ...current, retryKey: current.retryKey + 1 })),
    messages,
  };
};

export default useGetMessage;
