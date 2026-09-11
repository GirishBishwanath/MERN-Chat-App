import jwt from "jsonwebtoken";

const createTokenAndSaveCookie = (userId, res) => {
  // Support both names so existing Render environments using JWT_SECRET
  // and local environments using JWT_TOKEN keep working.
  const secret = process.env.JWT_TOKEN || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_TOKEN/JWT_SECRET environment variable is not configured");
  }

  const token = jwt.sign({ userId }, secret, {
    expiresIn: "10d",
  });

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 10 * 24 * 60 * 60 * 1000,
  });
};

export default createTokenAndSaveCookie;
