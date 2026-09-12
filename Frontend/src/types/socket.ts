import type { Message } from "./api";

export type MessageEventPayload = Message;

export interface ServerToClientEvents {
  getOnlineUsers: (userIds: string[]) => void;
  newMessage: (message: MessageEventPayload) => void;
}

export interface ClientToServerEvents {}
export interface InterServerEvents {}
export interface SocketData {}
