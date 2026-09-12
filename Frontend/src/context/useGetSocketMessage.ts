import { useEffect } from "react";
import sound from "../assets/notification.mp3";
import { useSocketContext } from "./SocketContext";
import { useConversationStore } from "../state/conversationStore";
import type { Message } from "../types/api";

const useGetSocketMessage = (): void => {
  const { socket } = useSocketContext();
  const selectedConversationId = useConversationStore(
    (state) => state.selectedConversation?._id
  );
  const appendMessage = useConversationStore((state) => state.appendMessage);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage: Message) => {
      const conversationId =
        newMessage.senderId === selectedConversationId
          ? newMessage.senderId
          : newMessage.receiverId === selectedConversationId
            ? newMessage.receiverId
            : undefined;

      if (!conversationId) return;

      appendMessage(conversationId, newMessage);
      const notification = new Audio(sound);
      void notification.play().catch(() => undefined);
    };

    socket.on("newMessage", handleNewMessage);
    return () => socket.off("newMessage", handleNewMessage);
  }, [appendMessage, selectedConversationId, socket]);
};

export default useGetSocketMessage;
