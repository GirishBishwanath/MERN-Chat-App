import bcrypt from "bcryptjs";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import type { UserDocument } from "../models/user.model.js";
import {
  createUser as createUserRepository,
  findByEmail as findByEmailRepository,
  findById as findByIdRepository,
  findPublicById as findPublicByIdRepository,
  listExcept as listExceptRepository,
  type PublicUser,
  type UserId,
} from "../repositories/user.repository.js";
import type { UserRepository } from "../repositories/user.repository.contract.js";

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

const defaultUserRepository: UserRepository = {
  findByEmail: findByEmailRepository,
  createUser: createUserRepository,
  findPublicById: findPublicByIdRepository,
  findById: findByIdRepository,
  listExcept: listExceptRepository,
};

const isRegisterUserInput = (input: unknown): input is RegisterUserInput => {
  if (typeof input !== "object" || input === null) {
    return false;
  }

  const value = input as Record<string, unknown>;
  return (
    typeof value.fullname === "string" &&
    typeof value.email === "string" &&
    typeof value.password === "string" &&
    typeof value.confirmPassword === "string"
  );
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const sanitizeUser = (
  user: Pick<UserDocument, "_id" | "fullname" | "email"> | PublicUser
): AuthenticatedUser => ({
  _id: user._id,
  fullname: user.fullname,
  email: user.email,
});

export const createUserService = (
  repository: UserRepository = defaultUserRepository
) => ({
  registerUser: async (input: unknown): Promise<UserDocument> => {
    if (!isRegisterUserInput(input)) {
      throw new AppError("Invalid signup data", 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const { fullname, email, password, confirmPassword } = input;

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
    const existingUser = await repository.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new AppError("User already registered", 409, ERROR_CODES.CONFLICT);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    return repository.createUser({
      fullname: fullname.trim(),
      email: normalizedEmail,
      password: passwordHash,
    });
  },

  authenticateUser: async (
    email: string,
    password: string
  ): Promise<UserDocument> => {
    if (typeof email !== "string" || typeof password !== "string") {
      throw new AppError(
        "Invalid user credential",
        401,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    const user = await repository.findByEmail(normalizeEmail(email), true);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError(
        "Invalid user credential",
        401,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    return user;
  },

  getPublicUser: async (id: UserId): Promise<PublicUser> => {
    const user = await repository.findPublicById(id);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODES.NOT_FOUND);
    }
    return user;
  },

  getUsersExcept: (userId: UserId): Promise<PublicUser[]> =>
    repository.listExcept(userId),
});

const userService = createUserService();

export const registerUser = userService.registerUser;
export const authenticateUser = userService.authenticateUser;
export const getPublicUser = userService.getPublicUser;
export const getUsersExcept = userService.getUsersExcept;
