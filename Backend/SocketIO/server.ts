import http from "node:http";
import express from "express";
import { Server } from "socket.io";

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

const users: Record<string, string> = {};

export const getReceiverSocketId = (receiverId: string): string | undefined =>
  users[receiverId];

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
  console.log("a user connected", socket.id);

  const userId = socket.handshake.query.userId;
  const connectedUserId = typeof userId === "string" ? userId : undefined;

  if (connectedUserId) {
    users[connectedUserId] = socket.id;
  }

  io.emit("getOnlineUsers", Object.keys(users));

  socket.on("disconnect", () => {
    console.log("a user disconnected", socket.id);

    if (connectedUserId) {
      delete users[connectedUserId];
    }

    io.emit("getOnlineUsers", Object.keys(users));
  });
});

export { app, io, server };
