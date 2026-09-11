import crypto from "crypto";
import jwt from "jsonwebtoken";
import Session from "../models/session.model.js";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not configured");
  }

  return secret;
};

const isProduction = process.env.NODE_ENV === "production";

const accessCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 15 * 60 * 1000,
  path: "/",
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: REFRESH_TOKEN_TTL_MS,
  path: "/api/user",
};

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const createRefreshToken = () => crypto.randomBytes(48).toString("base64url");

const issueAccessToken = (userId) =>
  jwt.sign({ userId: userId.toString() }, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_TTL,
  });

export const setAuthCookies = async (userId, res) => {
  const refreshToken = createRefreshToken();
  const now = new Date();

  await Session.create({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    lastUsedAt: now,
  });

  res.cookie("accessToken", issueAccessToken(userId), accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
};

export const rotateRefreshSession = async (refreshToken, res) => {
  const newRefreshToken = createRefreshToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);

  const session = await Session.findOneAndUpdate(
    {
      tokenHash: hashToken(refreshToken),
      expiresAt: { $gt: now },
    },
    {
      $set: {
        tokenHash: hashToken(newRefreshToken),
        expiresAt,
        lastUsedAt: now,
      },
    },
    { new: true }
  );

  if (!session) {
    return null;
  }

  res.cookie("accessToken", issueAccessToken(session.userId), accessCookieOptions);
  res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);
  return session;
};

export const revokeRefreshSession = async (refreshToken) => {
  if (!refreshToken) return;
  await Session.deleteOne({ tokenHash: hashToken(refreshToken) });
};

export const revokeAllSessions = async (userId) => {
  await Session.deleteMany({ userId });
};

export const clearAuthCookies = (res) => {
  res.clearCookie("accessToken", accessCookieOptions);
  res.clearCookie("refreshToken", refreshCookieOptions);
};

export const verifyAccessToken = (token) => jwt.verify(token, getJwtSecret());
