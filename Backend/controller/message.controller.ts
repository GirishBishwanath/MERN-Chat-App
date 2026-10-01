import type { Response } from "express";
import { getUserRoomName, io } from "../SocketIO/server.js";
import { getMessages, sendMessage as createMessage, type SerializedMessage } from "../services/message.service.js";
import { getMessagePageOptions } from "../validation/message.schemas.js";
import type { AuthenticatedRequest } from "../types/http.js";
import { createMessageCreatedEvent } from "../events/contracts.js";
import { eventPublisher } from "../events/publisher.js";
import { logger } from "../utils/logger.js";

const serializeForEvent = (message: SerializedMessage) => message;

export const sendMessage = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const receiverId = req.params.id;
  const { message } = req.body as { message: string };
  const result = await createMessage({ senderId: req.user._id, receiverId, message });
  io.to(getUserRoomName(receiverId)).emit("newMessage", serializeForEvent(result.message));

  const event = createMessageCreatedEvent({
    messageId: result.message._id,
    conversationId: result.conversationId,
    senderId: result.message.senderId,
    recipientId: result.message.receiverId,
    createdAt: result.message.createdAt,
    correlationId: req.requestId,
  });

  void eventPublisher.publishMessageCreated(event).catch((error: unknown) => {
    logger.error("kafka_event_publication_failed", {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      correlationId: event.correlationId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  });

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
