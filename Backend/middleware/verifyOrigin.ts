import type { NextFunction, Request, Response } from "express";

import { config } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const requestOrigin = (req: Request): string | null => {
  const origin = req.get("Origin");
  if (origin) return origin;

  const referer = req.get("Referer");
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
};

export const verifyRequestOrigin = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!UNSAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = requestOrigin(req);
  if (!origin || !config.corsOrigins.includes(origin)) {
    next(
      new AppError(
        "Request origin is not allowed",
        403,
        ERROR_CODES.CSRF_BLOCKED
      )
    );
    return;
  }

  next();
};
