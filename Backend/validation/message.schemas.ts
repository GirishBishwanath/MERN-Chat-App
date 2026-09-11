import type { Request } from "express";

import type { ValidationResult } from "../middleware/validateRequest.js";

const isObjectId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export const sendMessageSchema = (req: Request): ValidationResult => {
  const errors: Record<string, string> = {};
  const { id } = req.params;
  const body = typeof req.body === "object" && req.body !== null ? req.body : {};
  const message = "message" in body ? body.message : undefined;

  if (!isObjectId(id)) {
    errors.id = "A valid receiver id is required";
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    errors.message = "Message must not be empty";
  } else if (message.trim().length > 5000) {
    errors.message = "Message must not exceed 5000 characters";
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

export const getMessageSchema = (req: Request): ValidationResult => {
  const errors: Record<string, string> = {};
  if (!isObjectId(req.params.id)) {
    errors.id = "A valid chat user id is required";
  }
  return { valid: Object.keys(errors).length === 0, errors };
};
