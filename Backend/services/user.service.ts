import bcrypt from "bcryptjs";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import {
  createUser as createUserRepository, findByEmail as findByEmailRepository,
  findById as findByIdRepository, findPublicById as findPublicByIdRepository,
  listExcept as listExceptRepository, type PublicUser, type UserId,
} from "../repositories/user.repository.js";
import type { UserRepository } from "../repositories/user.repository.contract.js";
import { MAX_EMAIL_LENGTH, MAX_FULLNAME_LENGTH, MAX_PASSWORD_LENGTH } from "../validation/user.schemas.js";

export interface RegisterUserInput {
  fullname: string; email: string; password: string; confirmPassword: string;
}

export interface AuthenticatedUser {
  _id: string; fullname: string; email: string;
}

const defaultUserRepository: UserRepository = {
  findByEmail: async (email, includePassword = false) => {
    const user = await findByEmailRepository(email, includePassword);
    if (!user) return null;
    return {
      _id: user.id, fullname: user.fullname, email: user.email,
      password: user.passwordHash,
    };
  },
  createUser: async (data) => {
    const user = await createUserRepository(data);
    return { _id: user.id, fullname: user.fullname, email: user.email, password: user.passwordHash };
  },
  findPublicById: findPublicByIdRepository,
  findById: findByIdRepository,
  listExcept: listExceptRepository,
};

const isRegisterUserInput = (input: unknown): input is RegisterUserInput => {
  if (typeof input !== "object" || input === null) return false;
  const value = input as Record<string, unknown>;
  return typeof value.fullname === "string" && typeof value.email === "string" &&
    typeof value.password === "string" && typeof value.confirmPassword === "string";
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const sanitizeUser = (user: Pick<AuthenticatedUser, "_id" | "fullname" | "email">): AuthenticatedUser => ({
  _id: user._id, fullname: user.fullname, email: user.email,
});

export const createUserService = (repository: UserRepository = defaultUserRepository) => ({
  registerUser: async (input: unknown): Promise<UserRecord> => {
    if (!isRegisterUserInput(input)) throw new AppError("Invalid signup data", 400, ERROR_CODES.VALIDATION_ERROR);
    const { fullname, email, password, confirmPassword } = input;
    if (
      fullname.trim().length < 2 || fullname.trim().length > MAX_FULLNAME_LENGTH ||
      email.trim().length > MAX_EMAIL_LENGTH || !email.includes("@") ||
      password.length < 8 || password.length > MAX_PASSWORD_LENGTH ||
      confirmPassword.length < 8 || confirmPassword.length > MAX_PASSWORD_LENGTH
    ) throw new AppError("Invalid signup data", 400, ERROR_CODES.VALIDATION_ERROR);
    if (password !== confirmPassword) throw new AppError("Passwords do not match", 400, ERROR_CODES.VALIDATION_ERROR);

    const normalizedEmail = normalizeEmail(email);
    if (await repository.findByEmail(normalizedEmail)) {
      throw new AppError("User already registered", 409, ERROR_CODES.CONFLICT);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    return repository.createUser({ fullname: fullname.trim(), email: normalizedEmail, password: passwordHash });
  },

  authenticateUser: async (email: string, password: string): Promise<UserRecord> => {
    if (
      typeof email !== "string" || typeof password !== "string" ||
      email.trim().length === 0 || email.trim().length > MAX_EMAIL_LENGTH ||
      password.length === 0 || password.length > MAX_PASSWORD_LENGTH
    ) throw new AppError("Invalid user credential", 401, ERROR_CODES.INVALID_CREDENTIALS);

    const user = await repository.findByEmail(normalizeEmail(email), true);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError("Invalid user credential", 401, ERROR_CODES.INVALID_CREDENTIALS);
    }
    return user;
  },

  getPublicUser: async (id: UserId): Promise<PublicUser> => {
    const user = await repository.findPublicById(id);
    if (!user) throw new AppError("User not found", 404, ERROR_CODES.NOT_FOUND);
    return user;
  },

  getUsersExcept: (userId: UserId): Promise<PublicUser[]> => repository.listExcept(userId),
});

export type UserRecord = {
  _id: string; fullname: string; email: string; password: string;
};

const userService = createUserService();
export const registerUser = userService.registerUser;
export const authenticateUser = userService.authenticateUser;
export const getPublicUser = userService.getPublicUser;
export const getUsersExcept = userService.getUsersExcept;
