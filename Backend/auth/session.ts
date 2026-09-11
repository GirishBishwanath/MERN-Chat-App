import crypto from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { CookieOptions, Response } from "express";
import type { Types } from "mongoose";

import { config } from "../config/env.js";
import Session, { type SessionDocument } from "../models/session.model.js";

const ACCESS_TOKEN_TTL = "15m" as const;
const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload extends JwtPayload {
  userId: string;
}

const isProduction = config.nodeEnv === "production";

const accessCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: ACCESS_COOKIE_MAX_AGE_MS,
  path: "/",
};

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: REFRESH_TOKEN_TTL_MS,
  path: "/api/user",
};

const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

const createRefreshToken = (): string =>
  crypto.randomBytes(48).toString("base64url");

const issueAccessToken = (userId: Types.ObjectId): string =>
  jwt.sign({ userId: userId.toString() }, config.jwtSecret, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

export const setAuthCookies = async (
  userId: Types.ObjectId,
  res: Response
): Promise<void> => {
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

export const refreshSession = async (
  refreshToken: string,
  res: Response
): Promise<SessionDocument | null> => {
  const now = new Date();
  const session = await Session.findOneAndUpdate(
    {
      tokenHash: hashToken(refreshToken),
      expiresAt: { $gt: now },
    },
    { $set: { lastUsedAt: now } },
    { new: true }
  );

  if (!session) {
    return null;
  }

  res.cookie("accessToken", issueAccessToken(session.userId), accessCookieOptions);
  return session;
};

export const revokeRefreshSession = async (
  refreshToken: string | undefined
): Promise<void> => {
  if (!refreshToken) return;
  await Session.deleteOne({ tokenHash: hashToken(refreshToken) });
};

export const revokeAllSessions = async (
  userId: Types.ObjectId
): Promise<void> => {
  await Session.deleteMany({ userId });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie("accessToken", accessCookieOptions);
  res.clearCookie("refreshToken", refreshCookieOptions);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, config.jwtSecret);

  if (typeof decoded === "string") {
    throw new Error("Invalid access token payload");
  }

  const { userId } = decoded;
  if (typeof userId !== "string") {
    throw new Error("Invalid access token payload");
  }

  return { ...decoded, userId };
};
