import User from "../models/user.model.js";
import { verifyAccessToken } from "../auth/session.js";

const secureRoute = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || typeof decoded !== "object" || !decoded.userId) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const user = await User.findById(decoded.userId).select("_id fullname email");
    if (!user) {
      return res.status(401).json({ error: "Invalid session" });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error?.name === "TokenExpiredError" || error?.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Session expired" });
    }

    console.error("Error in secureRoute:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export default secureRoute;
