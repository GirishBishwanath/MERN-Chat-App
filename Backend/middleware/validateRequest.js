import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";

export const validateRequest = (schema) => (req, res, next) => {
  const result = schema(req);

  if (result.valid) {
    return next();
  }

  return next(
    new AppError(
      "Request validation failed",
      400,
      ERROR_CODES.VALIDATION_ERROR,
      result.errors
    )
  );
};
