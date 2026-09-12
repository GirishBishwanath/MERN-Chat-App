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

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
