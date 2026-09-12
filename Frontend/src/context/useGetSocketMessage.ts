import { useEffect } from "react";
import sound from "../assets/notification.mp3";
import { useSocketContext } from "./SocketContext";
import { useConversationStore } from "../state/conversationStore";
import type { Message } from "../types/api";

const useGetSocketMessage = (): void => {
  const { socket } = useSocketContext();
  const appendMessage = useConversationStore((state) => state.appendMessage);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage: Message) => {
      const conversationId = useConversationStore.getState().selectedConversation?._id;
      if (!conversationId) return;

      const belongsToSelectedConversation =
        newMessage.senderId === conversationId || newMessage.receiverId === conversationId;
      if (!belongsToSelectedConversation) return;

      appendMessage(conversationId, newMessage);
      const notification = new Audio(sound);
      void notification.play().catch(() => undefined);
    };

    socket.on("newMessage", handleNewMessage);
    return () => socket.off("newMessage", handleNewMessage);
  }, [appendMessage, socket]);
};

export default useGetSocketMessage;
