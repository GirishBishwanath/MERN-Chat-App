import type { Request } from "express";

import type { ValidationResult } from "../middleware/validateRequest.js";

export const MAX_FULLNAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 320;
export const MAX_PASSWORD_LENGTH = 128;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const signupSchema = (req: Request): ValidationResult => {
  const body = isRecord(req.body) ? req.body : {};
  const { fullname, email, password, confirmPassword } = body;
  const errors: Record<string, string> = {};

  if (
    !isNonEmptyString(fullname) ||
    fullname.trim().length < 2 ||
    fullname.trim().length > MAX_FULLNAME_LENGTH
  ) {
    errors.fullname = `Full name must contain 2-${MAX_FULLNAME_LENGTH} characters`;
  }
  if (
    !isNonEmptyString(email) ||
    email.trim().length > MAX_EMAIL_LENGTH ||
    !email.includes("@")
  ) {
    errors.email = "A valid email is required";
  }
  if (
    !isNonEmptyString(password) ||
    password.length < 8 ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    errors.password = `Password must contain 8-${MAX_PASSWORD_LENGTH} characters`;
  }
  if (
    typeof confirmPassword !== "string" ||
    confirmPassword.length < 8 ||
    confirmPassword.length > MAX_PASSWORD_LENGTH
  ) {
    errors.confirmPassword = "Password confirmation is invalid";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

export const loginSchema = (req: Request): ValidationResult => {
  const body = isRecord(req.body) ? req.body : {};
  const { email, password } = body;
  const errors: Record<string, string> = {};

  if (
    !isNonEmptyString(email) ||
    email.trim().length > MAX_EMAIL_LENGTH ||
    !email.includes("@")
  ) {
    errors.email = "A valid email is required";
  }
  if (!isNonEmptyString(password) || password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `Password must be between 8 and ${MAX_PASSWORD_LENGTH} characters`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
};
