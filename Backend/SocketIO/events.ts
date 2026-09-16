export interface MessageEventPayload {
  _id: string;
  senderId: string;
  receiverId: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerToClientEvents {
  getOnlineUsers: (userIds: string[]) => void;
  newMessage: (message: MessageEventPayload) => void;
}

export interface ClientToServerEvents {}
export interface InterServerEvents {}
export interface SocketData {
  userId: string;
}
