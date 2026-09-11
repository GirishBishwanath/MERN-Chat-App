import type { NextFunction, Request, Response, RequestHandler } from "express";

import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export type RequestSchema = (req: Request) => ValidationResult;

export const validateRequest = (schema: RequestSchema): RequestHandler => (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const result = schema(req);

  if (result.valid) {
    next();
    return;
  }

  next(
    new AppError(
      "Request validation failed",
      400,
      ERROR_CODES.VALIDATION_ERROR,
      result.errors
    )
  );
};
