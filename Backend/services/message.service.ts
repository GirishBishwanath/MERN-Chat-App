import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import {
  createDirectConversation, findDirectConversation,
} from "../repositories/postgres/conversation.repository.js";
import {
  createMessage as createPostgresMessage,
  findMessagesByConversation,
} from "../repositories/postgres/message.repository.js";
import { findUserById } from "../repositories/postgres/user.repository.js";
import { decodeMessageCursor, encodeMessageCursor } from "../utils/messageCursor.js";

export interface SendMessageInput { senderId: string; receiverId: string; message: string; }
export interface GetMessagesInput { senderId: string; chatUserId: string; limit: number; cursor?: string; }
export interface SerializedMessage {
  _id: string; senderId: string; receiverId: string; message: string; createdAt: string; updatedAt: string;
}
export interface MessagePageResult { messages: SerializedMessage[]; nextCursor: string | null; hasMore: boolean; limit: number; }

const serializeMessage = (message: Awaited<ReturnType<typeof createPostgresMessage>>, receiverId: string): SerializedMessage => ({
  _id: message.id, senderId: message.senderId, receiverId, message: message.content,
  createdAt: message.createdAt.toISOString(), updatedAt: message.updatedAt.toISOString(),
});

export const sendMessage = async ({ senderId, receiverId, message }: SendMessageInput): Promise<SerializedMessage> => {
  if (senderId === receiverId) throw new AppError("You cannot send a message to yourself", 400, ERROR_CODES.VALIDATION_ERROR);
  if (!(await findUserById(receiverId))) throw new AppError("Receiver not found", 404, ERROR_CODES.NOT_FOUND);
  const conversation = await findDirectConversation(senderId, receiverId) ??
    await createDirectConversation(senderId, receiverId);
  const newMessage = await createPostgresMessage({
    conversationId: conversation.id, senderId, content: message.trim(),
  });
  return serializeMessage(newMessage, receiverId);
};

export const getMessages = async ({ senderId, chatUserId, limit, cursor }: GetMessagesInput): Promise<MessagePageResult> => {
  if (senderId === chatUserId) throw new AppError("You cannot access a conversation with yourself", 400, ERROR_CODES.VALIDATION_ERROR);
  if (!(await findUserById(chatUserId))) throw new AppError("User not found", 404, ERROR_CODES.NOT_FOUND);
  const conversation = await findDirectConversation(senderId, chatUserId);
  if (!conversation) throw new AppError("Conversation not found", 404, ERROR_CODES.NOT_FOUND);

  const decodedCursor = cursor ? decodeMessageCursor(cursor) ?? undefined : undefined;
  if (cursor && !decodedCursor) throw new AppError("Cursor is invalid or malformed", 400, ERROR_CODES.VALIDATION_ERROR);

  const page = await findMessagesByConversation(conversation.id, limit, decodedCursor);
  const messages = page.messages.map((message) =>
    serializeMessage(message, message.senderId === senderId ? chatUserId : senderId)
  );
  const oldest = page.messages[0];
  return {
    messages,
    nextCursor: page.hasMore && oldest ? encodeMessageCursor({
      createdAt: oldest.createdAt.toISOString(), id: oldest.id,
    }) : null,
    hasMore: page.hasMore, limit,
  };
};
