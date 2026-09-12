import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./AuthProvider";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../types/socket";

export type AppSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData
>;

interface SocketContextValue {
  socket: AppSocket | null;
  onlineUsers: string[];
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function useSocketContext(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocketContext must be used within a SocketProvider");
  }
  return context;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const { authUser } = useAuth();

  useEffect(() => {
    if (!authUser) {
      setSocket((currentSocket) => {
        currentSocket?.close();
        return null;
      });
      setOnlineUsers([]);
      return;
    }

    const nextSocket: AppSocket = io(
      import.meta.env.VITE_BACKEND_URL || "http://localhost:4002",
      {
        withCredentials: true,
        // Socket identity is still supplied by the legacy server handshake.
        // Phase 09 will replace this with server-derived authenticated identity.
        query: { userId: authUser._id },
      }
    );

    const handleOnlineUsers = (userIds: string[]) => setOnlineUsers(userIds);
    nextSocket.on("getOnlineUsers", handleOnlineUsers);
    setSocket(nextSocket);

    return () => {
      nextSocket.off("getOnlineUsers", handleOnlineUsers);
      nextSocket.close();
      setSocket((currentSocket) =>
        currentSocket === nextSocket ? null : currentSocket
      );
    };
  }, [authUser]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}
