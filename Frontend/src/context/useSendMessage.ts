import { useState } from "react";
import useConversation from "../statemanage/useConversation";
import axios from "../utils/axiosConfig";
import type { Message, SendMessageRequest } from "../types/api";

interface UseSendMessageResult {
  loading: boolean;
  sendMessages: (message: string) => Promise<void>;
}

const useSendMessage = (): UseSendMessageResult => {
  const [loading, setLoading] = useState(false);
  const { setMessage, selectedConversation } = useConversation();

  const sendMessages = async (message: string): Promise<void> => {
    if (!selectedConversation?._id || !message.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post<
        Message,
        { data: Message },
        SendMessageRequest
      >(`/api/message/send/${selectedConversation._id}`, { message });
      setMessage((currentMessages) => [...currentMessages, response.data]);
    } catch (error) {
      console.error("Error in send messages", error);
    } finally {
      setLoading(false);
    }
  };

  return { loading, sendMessages };
};

export default useSendMessage;
