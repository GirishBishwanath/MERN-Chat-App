import http from "node:http";
import express from "express";
import { Server } from "socket.io";

import { verifyAccessToken } from "../auth/session.js";
import { findPublicById } from "../repositories/user.repository.js";
import type { MessageDocument } from "../models/message.model.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  MessageEventPayload,
  ServerToClientEvents,
  SocketData,
} from "./events.js";

const app = express();
const server = http.createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: {
    origin: ["https://mern-chat-app-jade.vercel.app", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const socketsByUser = new Map<string, Set<string>>();
const USER_ROOM_PREFIX = "user:";

interface SocketAuthError extends Error {
  data: { code: "AUTH_REQUIRED" | "AUTH_INVALID" | "AUTH_EXPIRED" };
}

const createSocketAuthError = (
  code: SocketAuthError["data"]["code"],
  message: string
): SocketAuthError => {
  const error = new Error(message) as SocketAuthError;
  error.data = { code };
  return error;
};

const getCookie = (
  cookieHeader: string | undefined,
  cookieName: string
): string | undefined => {
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = cookie.slice(0, separatorIndex).trim();
    if (name !== cookieName) continue;

    const value = cookie.slice(separatorIndex + 1).trim();
    if (!value) return undefined;

    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
};

export const getUserRoomName = (userId: string): string =>
  `${USER_ROOM_PREFIX}${userId}`;

const addSocketForUser = (userId: string, socketId: string): boolean => {
  let sockets = socketsByUser.get(userId);
  const wasOffline = !sockets || sockets.size === 0;

  if (!sockets) {
    sockets = new Set<string>();
    socketsByUser.set(userId, sockets);
  }

  sockets.add(socketId);
  return wasOffline;
};

const removeSocketForUser = (userId: string, socketId: string): boolean => {
  const sockets = socketsByUser.get(userId);
  if (!sockets) return false;

  sockets.delete(socketId);
  if (sockets.size > 0) return false;

  socketsByUser.delete(userId);
  return true;
};

const getOnlineUserIds = (): string[] => Array.from(socketsByUser.keys());

io.use(async (socket, next) => {
  const token = getCookie(socket.handshake.headers.cookie, "accessToken");

  if (!token) {
    next(createSocketAuthError("AUTH_REQUIRED", "Authentication required"));
    return;
  }

  try {
    const { userId } = verifyAccessToken(token);
    const user = await findPublicById(userId);

    if (!user) {
      next(createSocketAuthError("AUTH_INVALID", "Invalid authentication"));
      return;
    }

    socket.data.userId = user._id.toString();
    next();
  } catch (error: unknown) {
    const code =
      error instanceof Error && error.name === "TokenExpiredError"
        ? "AUTH_EXPIRED"
        : "AUTH_INVALID";
    const message =
      code === "AUTH_EXPIRED" ? "Authentication expired" : "Invalid authentication";

    next(createSocketAuthError(code, message));
  }
});

export const toMessageEventPayload = (
  message: MessageDocument
): MessageEventPayload => ({
  _id: message._id.toString(),
  senderId: message.senderId.toString(),
  receiverId: message.receiverId.toString(),
  message: message.message,
  createdAt: message.createdAt.toISOString(),
  updatedAt: message.updatedAt.toISOString(),
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  const becameOnline = addSocketForUser(userId, socket.id);

  void socket.join(getUserRoomName(userId));

  if (becameOnline) {
    io.emit("getOnlineUsers", getOnlineUserIds());
  } else {
    // Keep the derived presence state deterministic for newly connected tabs/devices.
    socket.emit("getOnlineUsers", getOnlineUserIds());
  }

  socket.on("disconnect", () => {
    const becameOffline = removeSocketForUser(userId, socket.id);

    if (becameOffline) {
      io.emit("getOnlineUsers", getOnlineUserIds());
    }
  });
});

export { app, io, server };
