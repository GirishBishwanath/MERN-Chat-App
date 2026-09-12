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
  ServerToClientEvents,
} from "../types/socket";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type SocketConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

interface SocketContextValue {
  socket: AppSocket | null;
  onlineUsers: string[];
  connectionStatus: SocketConnectionStatus;
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
  const [connectionStatus, setConnectionStatus] =
    useState<SocketConnectionStatus>("disconnected");
  const { authUser } = useAuth();

  useEffect(() => {
    if (!authUser) {
      setSocket((currentSocket) => {
        currentSocket?.close();
        return null;
      });
      setOnlineUsers([]);
      setConnectionStatus("disconnected");
      return;
    }

    let active = true;
    const nextSocket: AppSocket = io(
      import.meta.env.VITE_BACKEND_URL || "http://localhost:4002",
      {
        withCredentials: true,
        // Socket identity is still supplied by the legacy server handshake.
        // Phase 09 will replace this with server-derived authenticated identity.
        query: { userId: authUser._id },
      }
    );

    const handleConnect = () => {
      if (!active) return;
      setConnectionStatus("connected");
    };

    const handleDisconnect = () => {
      if (!active) return;
      setConnectionStatus("reconnecting");
      setOnlineUsers([]);
    };

    const handleConnectError = () => {
      if (!active) return;
      setConnectionStatus("reconnecting");
      setOnlineUsers([]);
    };

    const handleOnlineUsers = (userIds: string[]) => {
      if (!active) return;
      setOnlineUsers(userIds);
    };

    setConnectionStatus("connecting");
    nextSocket.on("connect", handleConnect);
    nextSocket.on("disconnect", handleDisconnect);
    nextSocket.on("connect_error", handleConnectError);
    nextSocket.on("getOnlineUsers", handleOnlineUsers);
    setSocket(nextSocket);

    return () => {
      active = false;
      nextSocket.off("connect", handleConnect);
      nextSocket.off("disconnect", handleDisconnect);
      nextSocket.off("connect_error", handleConnectError);
      nextSocket.off("getOnlineUsers", handleOnlineUsers);
      nextSocket.close();
      setSocket((currentSocket) =>
        currentSocket === nextSocket ? null : currentSocket
      );
      setConnectionStatus("disconnected");
    };
  }, [authUser]);

  return (
    <SocketContext.Provider
      value={{ socket, onlineUsers, connectionStatus }}
    >
      {children}
    </SocketContext.Provider>
  );
}
