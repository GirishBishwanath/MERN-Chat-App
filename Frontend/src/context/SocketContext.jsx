import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import io from "socket.io-client";

const socketContext = createContext();

export const useSocketContext = () => useContext(socketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { authUser } = useAuth();

  useEffect(() => {
    if (!authUser) {
      setSocket((currentSocket) => {
        currentSocket?.close();
        return null;
      });
      setOnlineUsers([]);
      return undefined;
    }

    const nextSocket = io(
      import.meta.env.VITE_BACKEND_URL || "http://localhost:4002",
      {
        query: {
          userId: authUser._id,
        },
      }
    );

    setSocket(nextSocket);
    nextSocket.on("getOnlineUsers", setOnlineUsers);

    return () => {
      nextSocket.close();
      setSocket((currentSocket) =>
        currentSocket === nextSocket ? null : currentSocket
      );
    };
  }, [authUser]);

  return (
    <socketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </socketContext.Provider>
  );
};
