import { useEffect, useState } from "react";
import useConversation from "../statemanage/useConversation";
import axios from "../utils/axiosConfig";
import type { Message } from "../types/api";

interface MessagesResponse {
  messages: Message[];
}

interface UseGetMessageResult {
  loading: boolean;
  messages: Message[];
}

const useGetMessage = (): UseGetMessageResult => {
  const [loading, setLoading] = useState(false);
  const { messages, setMessage, selectedConversation } = useConversation();

  useEffect(() => {
    let mounted = true;

    const getMessages = async () => {
      if (!selectedConversation?._id) {
        setMessage([]);
        return;
      }

      setLoading(true);
      try {
        const response = await axios.get<Message[] | MessagesResponse>(
          `/api/message/get/${selectedConversation._id}`
        );
        if (!mounted) return;

        const data = response.data;
        setMessage(Array.isArray(data) ? data : data.messages);
      } catch (error) {
        if (mounted) console.error("Error in getting messages", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void getMessages();

    return () => {
      mounted = false;
    };
  }, [selectedConversation, setMessage]);

  return { loading, messages };
};

export default useGetMessage;
