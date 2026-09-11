import bcrypt from "bcryptjs";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import {
  createUser,
  findByEmail,
  findPublicById,
  listExcept,
} from "../repositories/user.repository.js";

export const sanitizeUser = (user) => ({
  _id: user._id,
  fullname: user.fullname,
  email: user.email,
});

const normalizeEmail = (email) => email.trim().toLowerCase();

export const registerUser = async ({
  fullname,
  email,
  password,
  confirmPassword,
}) => {
  if (
    typeof fullname !== "string" ||
    fullname.trim().length < 2 ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    throw new AppError("Invalid signup data", 400, ERROR_CODES.VALIDATION_ERROR);
  }

  if (password !== confirmPassword) {
    throw new AppError("Passwords do not match", 400, ERROR_CODES.VALIDATION_ERROR);
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await findByEmail(normalizedEmail);

  if (existingUser) {
    throw new AppError(
      "User already registered",
      409,
      ERROR_CODES.CONFLICT
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  return createUser({
    fullname: fullname.trim(),
    email: normalizedEmail,
    password: passwordHash,
  });
};

export const authenticateUser = async (email, password) => {
  if (typeof email !== "string" || typeof password !== "string") {
    throw new AppError(
      "Invalid user credential",
      401,
      ERROR_CODES.INVALID_CREDENTIALS
    );
  }

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

export const getPublicUser = async (id) => {
  const user = await findPublicById(id);
  if (!user) {
    throw new AppError("User not found", 404, ERROR_CODES.NOT_FOUND);
  }
  return user;
};

export const getUsersExcept = (userId) => listExcept(userId);
