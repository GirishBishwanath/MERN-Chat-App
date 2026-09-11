import Conversation from "../models/conversation.model.js";

export const findBetweenUsers = (userA, userB) =>
  Conversation.findOne({ members: { $all: [userA, userB] } });

export const createConversation = (members) => Conversation.create({ members });

export const appendMessage = (conversation, messageId) => {
  conversation.messages.push(messageId);
  return conversation.save();
};
