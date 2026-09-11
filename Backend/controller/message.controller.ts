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
import type { AuthenticatedRequest } from "../types/http.js";

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

  return res.status(201).json(newMessage);
};

export const getMessage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  const messages = await getMessages({
    senderId: req.user._id,
    chatUserId: new Types.ObjectId(req.params.id),
  });

  return res.status(200).json(messages);
};
