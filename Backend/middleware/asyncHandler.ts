import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncHandler<TRequest extends Request = Request> = (
  req: TRequest,
  res: Response,
  next: NextFunction
) => unknown | Promise<unknown>;

export const asyncHandler = <TRequest extends Request = Request>(
  handler: AsyncHandler<TRequest>
): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as TRequest, res, next)).catch(next);
  };
