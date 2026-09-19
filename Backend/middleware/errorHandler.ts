import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import { logger } from "../utils/logger.js";

interface ApiErrorResponse { error: string; code: string; requestId: string; details?: unknown; }
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isPostgresError = (error: unknown): error is { code?: unknown } =>
  isRecord(error) && typeof error.code === "string";

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, ERROR_CODES.NOT_FOUND));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next): Response => {
  let appError: AppError;
  if (error instanceof AppError) appError = error;
  else if (isRecord(error) && error.type === "entity.parse.failed") {
    appError = new AppError("Malformed JSON request", 400, ERROR_CODES.VALIDATION_ERROR);
  } else if (isRecord(error) && error.type === "entity.too.large") {
    appError = new AppError("Request payload is too large", 413, ERROR_CODES.REQUEST_TOO_LARGE);
  } else if (error instanceof Error && error.message === "CORS policy violation") {
    appError = new AppError("Origin is not allowed", 403, ERROR_CODES.FORBIDDEN);
  } else if (error instanceof jwt.TokenExpiredError) {
    appError = new AppError("Session expired", 401, ERROR_CODES.SESSION_EXPIRED);
  } else if (error instanceof jwt.JsonWebTokenError) {
    appError = new AppError("Invalid authentication", 401, ERROR_CODES.UNAUTHENTICATED);
  } else if (isPostgresError(error) && error.code === "23505") {
    appError = new AppError("Resource already exists", 409, ERROR_CODES.CONFLICT);
  } else if (isPostgresError(error) && error.code === "23503") {
    appError = new AppError("Referenced resource was not found", 400, ERROR_CODES.VALIDATION_ERROR);
  } else if (isPostgresError(error) && error.code === "22P02") {
    appError = new AppError("Invalid resource identifier", 400, ERROR_CODES.VALIDATION_ERROR);
  } else {
    appError = new AppError("Internal server error", 500, ERROR_CODES.INTERNAL_ERROR);
  }

  if (appError.statusCode >= 500) {
    logger.error("request_failed", {
      requestId: req.requestId, method: req.method, path: req.originalUrl,
      statusCode: appError.statusCode, errorName: error instanceof Error ? error.name : undefined,
    });
  }

  const response: ApiErrorResponse = {
    error: appError.message, code: appError.code, requestId: req.requestId,
  };
  if (appError.details !== undefined) response.details = appError.details;
  return res.status(appError.statusCode).json(response);
};
