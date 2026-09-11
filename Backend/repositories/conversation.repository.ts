import type { Types } from "mongoose";

import Conversation, { type ConversationDocument } from "../models/conversation.model.js";

export type ConversationUserId = Types.ObjectId | string;

export const findBetweenUsers = (
  userA: ConversationUserId,
  userB: ConversationUserId
): Promise<ConversationDocument | null> =>
  Conversation.findOne({ members: { $all: [userA, userB] } }).exec();

export const createConversation = (
  members: Types.ObjectId[]
): Promise<ConversationDocument> => Conversation.create({ members });

export const appendMessage = (
  conversation: ConversationDocument,
  messageId: Types.ObjectId
): Promise<ConversationDocument> => {
  conversation.messages.push(messageId);
  return conversation.save();
};
