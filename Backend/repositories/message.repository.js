import Message from "../models/message.model.js";

export const createMessage = (data) => Message.create(data);

export const findMessagesByIds = (ids) =>
  Message.find({ _id: { $in: ids } }).sort({ createdAt: 1 });
