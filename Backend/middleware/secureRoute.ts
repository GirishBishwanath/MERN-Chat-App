import type { NextFunction, Request, Response } from "express";

import {
  findActiveSessionById,
  verifyAccessToken,
} from "../auth/session.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import {
  findPublicById,
  type PublicUser,
} from "../repositories/user.repository.js";
import type { SessionDocument } from "../models/session.model.js";

type FindUser = (userId: string) => Promise<PublicUser | null>;
type FindSession = (
  sessionId: string,
  userId: string
) => Promise<SessionDocument | null>;

type SecureRouteOptions = {
  findUser?: FindUser;
  findSession?: FindSession;
};

const secureRoute = async (
  req: Request,
  res: Response,
  next: NextFunction,
  {
    findUser = findPublicById,
    findSession = findActiveSessionById,
  }: SecureRouteOptions = {}
): Promise<void> => {
  try {
    const token = req.cookies?.accessToken;
    if (typeof token !== "string") {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const decoded = verifyAccessToken(token);
    const session = await findSession(decoded.sessionId, decoded.userId);

    if (!session) {
      throw new AppError("Invalid session", 401, ERROR_CODES.UNAUTHENTICATED);
    }

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
