import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import { logger } from "../utils/logger.js";

export const notFoundHandler = (req, res, next) => {
  next(
    new AppError(
      `Route ${req.method} ${req.originalUrl} not found`,
      404,
      ERROR_CODES.NOT_FOUND
    )
  );
};

export const errorHandler = (error, req, res, _next) => {
  let appError = error;

  if (error?.name === "TokenExpiredError" || error?.name === "JsonWebTokenError") {
    appError = new AppError("Session expired", 401, ERROR_CODES.SESSION_EXPIRED);
  } else if (error?.name === "ValidationError") {
    appError = new AppError(
      "Database validation failed",
      400,
      ERROR_CODES.VALIDATION_ERROR
    );
  } else if (error?.name === "CastError") {
    appError = new AppError(
      "Invalid resource identifier",
      400,
      ERROR_CODES.VALIDATION_ERROR
    );
  } else if (error?.code === 11000) {
    appError = new AppError("Resource already exists", 409, ERROR_CODES.CONFLICT);
  } else if (!(error instanceof AppError)) {
    appError = new AppError("Internal server error", 500, ERROR_CODES.INTERNAL_ERROR);
  }

  if (appError.statusCode >= 500) {
    logger.error("request_failed", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: appError.statusCode,
      errorName: error?.name,
    });
  }

  const response = {
    error: appError.message,
    code: appError.code,
    requestId: req.requestId,
  };

  if (appError.details) {
    response.details = appError.details;
  }

  return res.status(appError.statusCode).json(response);
};
