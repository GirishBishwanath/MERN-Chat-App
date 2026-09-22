export type UserId = string;

export interface UserRecord {
  _id: string;
  fullname: string;
  email: string;
  password: string;
}

export interface PublicUser {
  _id: string;
  fullname: string;
  email: string;
}

export interface UserRepository {
  findByEmail(email: string, includePassword?: boolean): Promise<UserRecord | null>;
  createUser(data: Pick<UserRecord, "fullname" | "email" | "password">): Promise<UserRecord>;
  findPublicById(id: UserId): Promise<PublicUser | null>;
  findById(id: UserId): Promise<Pick<PublicUser, "_id"> | null>;
  listExcept(userId: UserId): Promise<PublicUser[]>;
}
