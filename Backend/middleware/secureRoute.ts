import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "../auth/session.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import { findPublicById, type PublicUser } from "../repositories/user.repository.js";

type FindUser = (userId: string) => Promise<PublicUser | null>;

type SecureRouteOptions = {
  findUser?: FindUser;
};

const secureRoute = async (
  req: Request,
  res: Response,
  next: NextFunction,
  { findUser = findPublicById }: SecureRouteOptions = {}
): Promise<void> => {
  try {
    const token = req.cookies?.accessToken;
    if (typeof token !== "string") {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const decoded = verifyAccessToken(token);
    const user = await findUser(decoded.userId);
    if (!user) {
      throw new AppError("Invalid session", 401, ERROR_CODES.UNAUTHENTICATED);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export default secureRoute;
