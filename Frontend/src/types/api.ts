export interface PublicUser {
  _id: string;
  fullname: string;
  email: string;
}

export interface Message {
  _id: string;
  senderId: string;
  receiverId: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: PublicUser;
}

export interface ApiErrorResponse {
  error: string;
  code: string;
  requestId: string;
}

export interface SendMessageRequest {
  message: string;
}

export interface MessagePageMeta {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface MessagePageResponse {
  data: Message[];
  meta: MessagePageMeta;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
