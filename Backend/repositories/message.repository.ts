import type { Types } from "mongoose";

import Message, { type MessageDocument } from "../models/message.model.js";

export interface CreateMessageInput {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  message: string;
}

export const createMessage = (
  data: CreateMessageInput
): Promise<MessageDocument> => Message.create(data);

export const findMessagesByIds = (
  ids: Types.ObjectId[]
): Promise<MessageDocument[]> =>
  Message.find({ _id: { $in: ids } }).sort({ createdAt: 1 }).exec();
