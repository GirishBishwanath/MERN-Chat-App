import User from "../models/user.model.js";
import { verifyAccessToken } from "../auth/session.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";

const secureRoute = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) {
      throw new AppError(
        "Authentication required",
        401,
        ERROR_CODES.UNAUTHENTICATED
      );
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || typeof decoded !== "object" || !decoded.userId) {
      throw new AppError("Invalid session", 401, ERROR_CODES.UNAUTHENTICATED);
    }

    const user = await User.findById(decoded.userId).select("_id fullname email");
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
