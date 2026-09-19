import {
  createUser as createPostgresUser,
  findUserById,
  findUserByNormalizedEmail,
  listUsersExcept,
  type PostgresUser,
} from "./postgres/user.repository.js";

export type UserId = string;
export type UserRecord = PostgresUser;
export type UserDocument = PostgresUser;

export interface PublicUser {
  _id: string;
  fullname: string;
  email: string;
}

const toPublicUser = (user: PostgresUser): PublicUser => ({
  _id: user.id, fullname: user.fullname, email: user.email,
});

export const findByEmail = async (
  email: string, includePassword = false
): Promise<PostgresUser | null> => {
  const user = await findUserByNormalizedEmail(email);
  if (!user) return null;
  return includePassword ? user : { ...user, passwordHash: "" };
};

export const createUser = async (
  data: { fullname: string; email: string; password: string }
): Promise<PostgresUser> => createPostgresUser({
  fullname: data.fullname, email: data.email, passwordHash: data.password,
});

export const findPublicById = async (id: UserId): Promise<PublicUser | null> => {
  const user = await findUserById(id);
  return user ? toPublicUser(user) : null;
};

export const findById = async (
  id: UserId
): Promise<Pick<PublicUser, "_id"> | null> => {
  const user = await findUserById(id);
  return user ? { _id: user.id } : null;
};

export const listExcept = async (userId: UserId): Promise<PublicUser[]> =>
  (await listUsersExcept(userId)).map((user) => ({
    _id: user.id, fullname: user.fullname, email: user.email,
  }));
