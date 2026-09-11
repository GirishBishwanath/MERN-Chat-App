import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import {
  createConversation,
  findBetweenUsers,
  appendMessage,
} from "../repositories/conversation.repository.js";
import {
  createMessage,
  findMessagesByIds,
} from "../repositories/message.repository.js";
import { findById } from "../repositories/user.repository.js";

export const sendMessage = async ({ senderId, receiverId, message }) => {
  if (senderId.toString() === receiverId.toString()) {
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

export const getMessages = async ({ senderId, chatUserId }) => {
  const conversation = await findBetweenUsers(senderId, chatUserId);
  if (!conversation) {
    return [];
  }

  return findMessagesByIds(conversation.messages);
};
