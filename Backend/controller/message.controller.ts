import type { Response } from "express";
import { Types } from "mongoose";

import {
  getReceiverSocketId,
  io,
  toMessageEventPayload,
} from "../SocketIO/server.js";
import {
  getMessages,
  sendMessage as createMessage,
} from "../services/message.service.js";
import { getMessagePageOptions } from "../validation/message.schemas.js";
import type { AuthenticatedRequest } from "../types/http.js";

const serializeMessage = (message: Awaited<ReturnType<typeof createMessage>>) => ({
  _id: message._id.toString(),
  senderId: message.senderId.toString(),
  receiverId: message.receiverId.toString(),
  message: message.message,
  createdAt: message.createdAt.toISOString(),
  updatedAt: message.updatedAt.toISOString(),
});

export const sendMessage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  const receiverId = new Types.ObjectId(req.params.id);
  const { message } = req.body as { message: string };

  const newMessage = await createMessage({
    senderId: req.user._id,
    receiverId,
    message,
  });

  const receiverSocketId = getReceiverSocketId(receiverId.toString());
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("newMessage", toMessageEventPayload(newMessage));
  }

  return res.status(201).json({ data: serializeMessage(newMessage) });
};

export const getMessage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  const { limit, cursor } = getMessagePageOptions(req);
  const page = await getMessages({
    senderId: req.user._id,
    chatUserId: new Types.ObjectId(req.params.id),
    limit,
    cursor,
  });

  return res.status(200).json({
    data: page.messages,
    meta: {
      limit: page.limit,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
    },
  });
};
