import mongoose, { type HydratedDocument, type Model } from "mongoose";

export interface User {
  fullname: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

const userSchema = new mongoose.Schema<User>(
  {
    fullname: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true }
);

const User: Model<User> = mongoose.model<User>("User", userSchema);

export default User;
