import mongoose, { type HydratedDocument, type Model, type Types } from "mongoose";

export interface Message {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageDocument = HydratedDocument<Message>;

const messageSchema = new mongoose.Schema<Message>(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1, _id: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1, _id: -1 });

const Message: Model<Message> = mongoose.model<Message>("message", messageSchema);

export default Message;
