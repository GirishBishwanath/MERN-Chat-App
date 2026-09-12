import { useEffect } from "react";
import sound from "../assets/notification.mp3";
import { useSocketContext } from "./SocketContext";
import { useConversationStore } from "../state/conversationStore";
import type { Message } from "../types/api";

const useSocketMessages = (): void => {
  const { socket } = useSocketContext();
  const appendMessage = useConversationStore((state) => state.appendMessage);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      const selectedUserId =
        useConversationStore.getState().selectedConversation?._id;

      if (!selectedUserId) return;

      const isForSelectedConversation =
        message.senderId === selectedUserId || message.receiverId === selectedUserId;

      if (!isForSelectedConversation) return;

      appendMessage(selectedUserId, message);

      const notification = new Audio(sound);
      void notification.play().catch(() => undefined);
    };

    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [appendMessage, socket]);
};

export default useSocketMessages;
