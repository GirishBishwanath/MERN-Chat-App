import bcrypt from "bcryptjs";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import type { UserDocument } from "../models/user.model.js";
import {
  createUser,
  findByEmail,
  findPublicById,
  listExcept,
  type PublicUser,
  type UserId,
} from "../repositories/user.repository.js";

export interface RegisterUserInput {
  fullname: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthenticatedUser {
  _id: UserDocument["_id"];
  fullname: string;
  email: string;
}

export const sanitizeUser = (
  user: Pick<UserDocument, "_id" | "fullname" | "email"> | PublicUser
): AuthenticatedUser => ({
  _id: user._id,
  fullname: user.fullname,
  email: user.email,
});

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const registerUser = async ({
  fullname,
  email,
  password,
  confirmPassword,
}: RegisterUserInput): Promise<UserDocument> => {
  if (
    fullname.trim().length < 2 ||
    !email.includes("@") ||
    password.length < 8
  ) {
    throw new AppError("Invalid signup data", 400, ERROR_CODES.VALIDATION_ERROR);
  }

  if (password !== confirmPassword) {
    throw new AppError("Passwords do not match", 400, ERROR_CODES.VALIDATION_ERROR);
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await findByEmail(normalizedEmail);

  if (existingUser) {
    throw new AppError("User already registered", 409, ERROR_CODES.CONFLICT);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  return createUser({
    fullname: fullname.trim(),
    email: normalizedEmail,
    password: passwordHash,
  });
};

export const authenticateUser = async (
  email: string,
  password: string
): Promise<UserDocument> => {
  const user = await findByEmail(normalizeEmail(email), true);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError(
      "Invalid user credential",
      401,
      ERROR_CODES.INVALID_CREDENTIALS
    );
  }

  return user;
};

export const getPublicUser = async (id: UserId): Promise<PublicUser> => {
  const user = await findPublicById(id);
  if (!user) {
    throw new AppError("User not found", 404, ERROR_CODES.NOT_FOUND);
  }
  return user;
};

export const getUsersExcept = (userId: UserId): Promise<PublicUser[]> =>
  listExcept(userId);
