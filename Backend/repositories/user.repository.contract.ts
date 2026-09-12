import type { Types } from "mongoose";

import type { User as UserRecord, UserDocument } from "../models/user.model.js";

export type UserId = Types.ObjectId | string;

export interface PublicUser {
  _id: Types.ObjectId;
  fullname: string;
  email: string;
}

export interface UserRepository {
  findByEmail(email: string, includePassword?: boolean): Promise<UserDocument | null>;
  createUser(data: Pick<UserRecord, "fullname" | "email" | "password">): Promise<UserDocument>;
  findPublicById(id: UserId): Promise<PublicUser | null>;
  findById(id: UserId): Promise<Pick<PublicUser, "_id"> | null>;
  listExcept(userId: UserId): Promise<PublicUser[]>;
}
