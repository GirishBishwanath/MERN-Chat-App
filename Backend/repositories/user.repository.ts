import type { Types } from "mongoose";

import User, { type User as UserRecord, type UserDocument } from "../models/user.model.js";

export type UserId = Types.ObjectId | string;

export interface PublicUser {
  _id: Types.ObjectId;
  fullname: string;
  email: string;
}

export const findByEmail = (
  email: string,
  includePassword = false
): Promise<UserDocument | null> => {
  const query = User.findOne({ email });
  return (includePassword ? query.select("+password") : query).exec();
};

export const createUser = (
  data: Pick<UserRecord, "fullname" | "email" | "password">
): Promise<UserDocument> => User.create(data);

export const findPublicById = (id: UserId): Promise<PublicUser | null> =>
  User.findById(id).select("_id fullname email").lean<PublicUser>().exec();

export const findById = (id: UserId): Promise<Pick<PublicUser, "_id"> | null> =>
  User.findById(id).select("_id").lean<Pick<PublicUser, "_id">>().exec();

export const listExcept = (userId: UserId): Promise<PublicUser[]> =>
  User.find({ _id: { $ne: userId } })
    .select("_id fullname email")
    .lean<PublicUser[]>()
    .exec();
