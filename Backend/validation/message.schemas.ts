import type { Request } from "express";

import type { ValidationResult } from "../middleware/validateRequest.js";
import { decodeMessageCursor } from "../utils/messageCursor.js";

export const DEFAULT_MESSAGE_PAGE_SIZE = 50;
export const MAX_MESSAGE_PAGE_SIZE = 100;

const isObjectId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

const parseLimit = (value: unknown): number | undefined => {
  if (value === undefined) return DEFAULT_MESSAGE_PAGE_SIZE;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;

  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= MAX_MESSAGE_PAGE_SIZE
    ? limit
    : undefined;
};

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

  const limit = parseLimit(req.query.limit);
  if (limit === undefined) {
    errors.limit = `Limit must be an integer between 1 and ${MAX_MESSAGE_PAGE_SIZE}`;
  }

  if (req.query.cursor !== undefined) {
    if (typeof req.query.cursor !== "string" || !decodeMessageCursor(req.query.cursor)) {
      errors.cursor = "Cursor is invalid or malformed";
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

export const getMessagePageOptions = (req: Request): { limit: number; cursor?: string } => ({
  limit: parseLimit(req.query.limit) ?? DEFAULT_MESSAGE_PAGE_SIZE,
  cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
});
