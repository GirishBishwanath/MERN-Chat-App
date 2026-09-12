import { useState } from "react";
import axiosClient from "../utils/axiosConfig";
import { useConversationStore } from "../state/conversationStore";
import type { Message, SendMessageRequest } from "../types/api";

interface UseSendMessageResult {
  loading: boolean;
  error: boolean;
  sendMessage: (message: string) => Promise<boolean>;
}

export function useSendMessage(): UseSendMessageResult {
  const selectedConversationId = useConversationStore(
    (state) => state.selectedConversation?._id
  );
  const appendMessage = useConversationStore((state) => state.appendMessage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const sendMessage = async (message: string): Promise<boolean> => {
    const conversationId = selectedConversationId;
    const trimmedMessage = message.trim();

    if (!conversationId || !trimmedMessage || loading) return false;

    setLoading(true);
    setError(false);

    try {
      const response = await axiosClient.post<
        Message,
        { data: Message },
        SendMessageRequest
      >(`/api/message/send/${conversationId}`, { message: trimmedMessage });

      appendMessage(conversationId, response.data);
      return true;
    } catch (requestError) {
      console.error("Failed to send message", requestError);
      setError(true);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, sendMessage };
}
