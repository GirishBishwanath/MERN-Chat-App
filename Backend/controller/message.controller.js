import { getReceiverSocketId, io } from "../SocketIO/server.js";
import {
  getMessages,
  sendMessage as createMessage,
} from "../services/message.service.js";

export const sendMessage = async (req, res) => {
  const { message } = req.body;
  const { id: receiverId } = req.params;
  const newMessage = await createMessage({
    senderId: req.user._id,
    receiverId,
    message,
  });

  const receiverSocketId = getReceiverSocketId(receiverId);
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("newMessage", newMessage);
  }

  return res.status(201).json(newMessage);
};

export const getMessage = async (req, res) => {
  const messages = await getMessages({
    senderId: req.user._id,
    chatUserId: req.params.id,
  });

  return res.status(200).json(messages);
};
