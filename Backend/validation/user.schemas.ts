import type { Request } from "express";

import type { ValidationResult } from "../middleware/validateRequest.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const signupSchema = (req: Request): ValidationResult => {
  const body = isRecord(req.body) ? req.body : {};
  const { fullname, email, password, confirmPassword } = body;
  const errors: Record<string, string> = {};

  if (!isNonEmptyString(fullname) || fullname.trim().length < 2) {
    errors.fullname = "Full name must contain at least 2 characters";
  }
  if (!isNonEmptyString(email) || !email.includes("@")) {
    errors.email = "A valid email is required";
  }
  if (!isNonEmptyString(password) || password.length < 8) {
    errors.password = "Password must contain at least 8 characters";
  }
  if (typeof confirmPassword !== "string") {
    errors.confirmPassword = "Password confirmation is required";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

export const loginSchema = (req: Request): ValidationResult => {
  const body = isRecord(req.body) ? req.body : {};
  const { email, password } = body;
  const errors: Record<string, string> = {};

  if (!isNonEmptyString(email) || !email.includes("@")) {
    errors.email = "A valid email is required";
  }
  if (!isNonEmptyString(password)) {
    errors.password = "Password is required";
  }

  return { valid: Object.keys(errors).length === 0, errors };
};
