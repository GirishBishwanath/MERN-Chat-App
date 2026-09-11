import mongoose, { type HydratedDocument, type Model, type Types } from "mongoose";

export interface Conversation {
  members: Types.ObjectId[];
  messages: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationDocument = HydratedDocument<Conversation>;

const conversationSchema = new mongoose.Schema<Conversation>(
  {
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    messages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "message",
        default: [],
      },
    ],
  },
  { timestamps: true }
);

const Conversation: Model<Conversation> = mongoose.model<Conversation>(
  "conversation",
  conversationSchema
);

export default Conversation;
