import mongoose, { type HydratedDocument, type Model, type Types } from "mongoose";

export interface Session {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SessionDocument = HydratedDocument<Session>;

const sessionSchema = new mongoose.Schema<Session>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastUsedAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

sessionSchema.index({ userId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session: Model<Session> = mongoose.model<Session>("Session", sessionSchema);

export default Session;
