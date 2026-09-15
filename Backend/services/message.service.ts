import type { Types } from "mongoose";

import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import {
  appendMessage,
  createConversation,
  findBetweenUsers,
} from "../repositories/conversation.repository.js";
import {
  createMessage,
  findMessagePage,
} from "../repositories/message.repository.js";
import { findById } from "../repositories/user.repository.js";
import { decodeMessageCursor, encodeMessageCursor } from "../utils/messageCursor.js";

export interface SendMessageInput {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  message: string;
}

export interface GetMessagesInput {
  senderId: Types.ObjectId;
  chatUserId: Types.ObjectId;
  limit: number;
  cursor?: string;
}

export interface SerializedMessage {
  _id: string;
  senderId: string;
  receiverId: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessagePageResult {
  messages: SerializedMessage[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

const serializeMessage = (message: Awaited<ReturnType<typeof createMessage>>): SerializedMessage => ({
  _id: message._id.toString(),
  senderId: message.senderId.toString(),
  receiverId: message.receiverId.toString(),
  message: message.message,
  createdAt: message.createdAt.toISOString(),
  updatedAt: message.updatedAt.toISOString(),
});

export const sendMessage = async ({
  senderId,
  receiverId,
  message,
}: SendMessageInput) => {
  if (senderId.equals(receiverId)) {
    throw new AppError(
      "You cannot send a message to yourself",
      400,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const receiver = await findById(receiverId);
  if (!receiver) {
    throw new AppError("Receiver not found", 404, ERROR_CODES.NOT_FOUND);
  }

  let conversation = await findBetweenUsers(senderId, receiverId);
  if (!conversation) {
    conversation = await createConversation([senderId, receiverId]);
  }

  const newMessage = await createMessage({
    senderId,
    receiverId,
    message: message.trim(),
  });

  await appendMessage(conversation, newMessage._id);
  return newMessage;
};

export const getMessages = async ({
  senderId,
  chatUserId,
  limit,
  cursor,
}: GetMessagesInput): Promise<MessagePageResult> => {
  if (senderId.equals(chatUserId)) {
    throw new AppError(
      "You cannot access a conversation with yourself",
      400,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const receiver = await findById(chatUserId);
  if (!receiver) {
    throw new AppError("User not found", 404, ERROR_CODES.NOT_FOUND);
  }

  const conversation = await findBetweenUsers(senderId, chatUserId);
  if (!conversation) {
    throw new AppError("Conversation not found", 404, ERROR_CODES.NOT_FOUND);
  }

  const decodedCursor = cursor ? decodeMessageCursor(cursor) ?? undefined : undefined;
  if (cursor && !decodedCursor) {
    throw new AppError("Cursor is invalid or malformed", 400, ERROR_CODES.VALIDATION_ERROR);
  }

  const page = await findMessagePage({
    userAId: senderId,
    userBId: chatUserId,
    limit,
    cursor: decodedCursor,
  });

  const messages = page.messages.map(serializeMessage);
  const oldest = page.messages[0];

  return {
    messages,
    nextCursor:
      page.hasMore && oldest
        ? encodeMessageCursor({
            createdAt: oldest.createdAt.toISOString(),
            id: oldest._id.toString(),
          })
        : null,
    hasMore: page.hasMore,
    limit,
  };
};
