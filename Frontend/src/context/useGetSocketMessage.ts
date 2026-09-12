import { useEffect } from "react";
import sound from "../assets/notification.mp3";
import { useSocketContext } from "./SocketContext";
import useConversation from "../statemanage/useConversation";
import type { Message } from "../types/api";

const useGetSocketMessage = (): void => {
  const { socket } = useSocketContext();
  const setMessage = useConversation((state) => state.setMessage);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage: Message) => {
      setMessage((currentMessages) => [...currentMessages, newMessage]);
      const notification = new Audio(sound);
      void notification.play().catch(() => {
        // Browsers can block autoplay until the user has interacted with the page.
      });
    };

    socket.on("newMessage", handleNewMessage);
    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [socket, setMessage]);
};

export default useGetSocketMessage;
