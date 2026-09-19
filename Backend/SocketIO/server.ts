import http from "node:http";
import express from "express";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { config } from "../config/env.js";
import { findActiveSessionById, verifyAccessToken } from "../auth/session.js";
import { findPublicById } from "../repositories/user.repository.js";
import { closeRedis, connectRedis, createRedisSubscriber, getRedisClient, verifyRedisConnection } from "../infra/redis/client.js";
import { getOnlineUserIds, markUserOffline, markUserOnline } from "../infra/redis/presence.js";
import { logger } from "../utils/logger.js";
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "./events.js";

const app = express();
const server = http.createServer(app);
const redisClient = getRedisClient();
const redisSubscriber = createRedisSubscriber();
const HEARTBEAT_INTERVAL_MS = 30_000;

redisSubscriber.on("error", (error: unknown) => logger.error("redis_subscriber_error", {
  errorName: error instanceof Error ? error.name : "UnknownError",
}));

export const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  server, { adapter: createAdapter(redisClient, redisSubscriber), cors: {
    origin: config.corsOrigins, methods: ["GET", "POST"], credentials: true,
  }}
);

const socketsByUser = new Map<string, Set<string>>();
const USER_ROOM_PREFIX = "user:";
interface SocketAuthError extends Error { data: { code: "AUTH_REQUIRED" | "AUTH_INVALID" | "AUTH_EXPIRED" }; }
const createSocketAuthError = (code: SocketAuthError["data"]["code"], message: string): SocketAuthError => {
  const error = new Error(message) as SocketAuthError; error.data = { code }; return error;
};
const getCookie = (cookieHeader: string | undefined, cookieName: string): string | undefined => {
  if (!cookieHeader) return undefined;
  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("="); if (separatorIndex === -1) continue;
    const name = cookie.slice(0, separatorIndex).trim(); if (name !== cookieName) continue;
    const value = cookie.slice(separatorIndex + 1).trim(); if (!value) return undefined;
    try { return decodeURIComponent(value); } catch { return undefined; }
  }
  return undefined;
};
export const getUserRoomName = (userId: string): string => `${USER_ROOM_PREFIX}${userId}`;
const addSocketForUser = (userId: string, socketId: string): boolean => {
  let sockets = socketsByUser.get(userId); const wasOffline = !sockets || sockets.size === 0;
  if (!sockets) { sockets = new Set<string>(); socketsByUser.set(userId, sockets); }
  sockets.add(socketId); return wasOffline;
};
const removeSocketForUser = (userId: string, socketId: string): boolean => {
  const sockets = socketsByUser.get(userId); if (!sockets) return false;
  sockets.delete(socketId); if (sockets.size > 0) return false;
  socketsByUser.delete(userId); return true;
};
const emitOnlineUsers = async (): Promise<void> => {
  io.emit("getOnlineUsers", await getOnlineUserIds(redisClient));
};

io.use(async (socket, next) => {
  const token = getCookie(socket.handshake.headers.cookie, "accessToken");
  if (!token) { next(createSocketAuthError("AUTH_REQUIRED", "Authentication required")); return; }
  try {
    const { userId, sessionId } = verifyAccessToken(token);
    if (!(await findActiveSessionById(sessionId, userId))) {
      next(createSocketAuthError("AUTH_INVALID", "Invalid authentication")); return;
    }
    const user = await findPublicById(userId);
    if (!user) { next(createSocketAuthError("AUTH_INVALID", "Invalid authentication")); return; }
    socket.data.userId = user._id;
    next();
  } catch (error: unknown) {
    const code = error instanceof Error && error.name === "TokenExpiredError" ? "AUTH_EXPIRED" : "AUTH_INVALID";
    next(createSocketAuthError(code, code === "AUTH_EXPIRED" ? "Authentication expired" : "Invalid authentication"));
  }
});

export const initializeRedisAdapter = async (): Promise<void> => {
  await connectRedis(); await redisSubscriber.connect(); await verifyRedisConnection();
};
export const closeSocketInfrastructure = async (): Promise<void> => {
  await io.close(); if (redisSubscriber.isOpen) await redisSubscriber.quit(); await closeRedis();
};

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  const becameOnline = addSocketForUser(userId, socket.id);
  void socket.join(getUserRoomName(userId));
  void markUserOnline(redisClient, userId, socket.id).then(async () => {
    const onlineUserIds = await getOnlineUserIds(redisClient);
    if (becameOnline) io.emit("getOnlineUsers", onlineUserIds);
    else socket.emit("getOnlineUsers", onlineUserIds);
  }).catch((error: unknown) => logger.error("redis_presence_set_failed", { errorName: error instanceof Error ? error.name : "UnknownError" }));

  const heartbeat = setInterval(() => void markUserOnline(redisClient, userId, socket.id).catch((error: unknown) =>
    logger.error("redis_presence_refresh_failed", { errorName: error instanceof Error ? error.name : "UnknownError" })
  ), HEARTBEAT_INTERVAL_MS);

  socket.on("disconnect", () => {
    clearInterval(heartbeat); const becameOffline = removeSocketForUser(userId, socket.id);
    void markUserOffline(redisClient, userId, socket.id).then(async () => {
      if (!becameOffline) return;
      await emitOnlineUsers();
    }).catch((error: unknown) => logger.error("redis_presence_delete_failed", { errorName: error instanceof Error ? error.name : "UnknownError" }));
  });
});

export { app, server };
