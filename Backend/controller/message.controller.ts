import type { Response } from "express";

import { getUserRoomName, io } from "../SocketIO/server.js";
import { getMessages, sendMessage as createMessage } from "../services/message.service.js";
import { getMessagePageOptions } from "../validation/message.schemas.js";
import type { AuthenticatedRequest } from "../types/http.js";

export const sendMessage = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const receiverId = req.params.id;
  const { message } = req.body as { message: string };
  const result = await createMessage({
    senderId: req.user._id,
    receiverId,
    message,
    correlationId: req.requestId,
  });

  io.to(getUserRoomName(receiverId)).emit("newMessage", result.message);

  return res.status(201).json({ data: result.message });
};

export const getMessage = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { limit, cursor } = getMessagePageOptions(req);
  const page = await getMessages({
    senderId: req.user._id, chatUserId: req.params.id, limit, cursor,
  });
  return res.status(200).json({
    data: page.messages,
    meta: { limit: page.limit, hasMore: page.hasMore, nextCursor: page.nextCursor },
  });
};
