import { useEffect, useState } from "react";
import axiosClient from "../utils/axiosConfig";
import { useConversationStore } from "../state/conversationStore";
import type { Message } from "../types/api";

interface MessagesResponse {
  messages: Message[];
}

export interface UseMessagesResult {
  messages: Message[];
  loading: boolean;
  error: boolean;
  retry: () => void;
}

export function useMessages(): UseMessagesResult {
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
  const [retryKey, setRetryKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!selectedConversationId) {
      setLoading(false);
      setError(false);
      return;
    }

    const conversationId = selectedConversationId;
    const controller = new AbortController();
    let cancelled = false;

    const loadMessages = async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await axiosClient.get<Message[] | MessagesResponse>(
          `/api/message/get/${conversationId}`,
          { signal: controller.signal }
        );
        if (cancelled) return;

        const data = response.data;
        replaceMessages(conversationId, Array.isArray(data) ? data : data.messages);
        setLoading(false);
      } catch (requestError) {
        if (!cancelled && !controller.signal.aborted) {
          console.error("Failed to load messages", requestError);
          setLoading(false);
          setError(true);
        }
      }
    };

    void loadMessages();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [replaceMessages, retryKey, selectedConversationId]);

  return {
    messages,
    loading,
    error,
    retry: () => setRetryKey((current) => current + 1),
  };
}
