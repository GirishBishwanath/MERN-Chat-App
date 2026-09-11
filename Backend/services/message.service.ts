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
  findMessagesByIds,
} from "../repositories/message.repository.js";
import { findById } from "../repositories/user.repository.js";

export interface SendMessageInput {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  message: string;
}

export interface GetMessagesInput {
  senderId: Types.ObjectId;
  chatUserId: Types.ObjectId;
}

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
}: GetMessagesInput) => {
  const conversation = await findBetweenUsers(senderId, chatUserId);
  if (!conversation) {
    return [];
  }

  return findMessagesByIds(conversation.messages);
};
