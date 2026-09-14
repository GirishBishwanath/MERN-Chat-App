import { Types } from "mongoose";

import Message, { type MessageDocument } from "../models/message.model.js";
import type { MessageCursor } from "../utils/messageCursor.js";

export interface CreateMessageInput {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  message: string;
}

export interface MessagePage {
  messages: MessageDocument[];
  hasMore: boolean;
}

export const createMessage = (
  data: CreateMessageInput
): Promise<MessageDocument> => Message.create(data);

export const findMessagesByIds = (
  ids: Types.ObjectId[]
): Promise<MessageDocument[]> =>
  Message.find({ _id: { $in: ids } }).sort({ createdAt: 1, _id: 1 }).exec();

export const findMessagePage = async (input: {
  userAId: Types.ObjectId;
  userBId: Types.ObjectId;
  limit: number;
  cursor?: MessageCursor;
}): Promise<MessagePage> => {
  const pairFilter = {
    $or: [
      { senderId: input.userAId, receiverId: input.userBId },
      { senderId: input.userBId, receiverId: input.userAId },
    ],
  };

  const cursorFilter = input.cursor
    ? {
        $or: [
          { createdAt: { $lt: new Date(input.cursor.createdAt) } },
          {
            createdAt: new Date(input.cursor.createdAt),
            _id: { $lt: new Types.ObjectId(input.cursor.id) },
          },
        ],
      }
    : undefined;

  const filter = cursorFilter ? { $and: [pairFilter, cursorFilter] } : pairFilter;
  const rows = await Message.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(input.limit + 1)
    .exec();

  const hasMore = rows.length > input.limit;
  const messages = (hasMore ? rows.slice(0, input.limit) : rows).reverse();

  return { messages, hasMore };
};
