import { findPublicById } from "../repositories/user.repository.js";
import { verifyAccessToken } from "../auth/session.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";

const secureRoute = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || typeof decoded !== "object" || !decoded.userId) {
      throw new AppError("Invalid session", 401, ERROR_CODES.UNAUTHENTICATED);
    }

    const user = await findPublicById(decoded.userId);
    if (!user) {
      throw new AppError("Invalid session", 401, ERROR_CODES.UNAUTHENTICATED);
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export default secureRoute;
