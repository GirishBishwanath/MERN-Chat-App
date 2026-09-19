import crypto from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { CookieOptions, Response } from "express";

import { config } from "../config/env.js";
import {
  createSession,
  findActiveSessionByTokenHash,
  findActiveSessionById as findSessionById,
  revokeSessionByTokenHash,
  revokeAllSessionsForUser,
  type PostgresSession,
} from "../repositories/postgres/session.repository.js";

const ACCESS_TOKEN_TTL = "15m" as const;
const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload extends JwtPayload {
  userId: string;
  sessionId: string;
}

const isProduction = config.nodeEnv === "production";
const accessCookieOptions: CookieOptions = {
  httpOnly: true, secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: ACCESS_COOKIE_MAX_AGE_MS, path: "/",
};
const refreshCookieOptions: CookieOptions = {
  httpOnly: true, secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: REFRESH_TOKEN_TTL_MS, path: "/api/user",
};

const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

const createRefreshToken = (): string =>
  crypto.randomBytes(48).toString("base64url");

const issueAccessToken = (userId: string, sessionId: string): string =>
  jwt.sign({ userId, sessionId }, config.jwtSecret, {
    expiresIn: ACCESS_TOKEN_TTL, algorithm: "HS256",
  });

export const setAuthCookies = async (userId: string, res: Response): Promise<void> => {
  const refreshToken = createRefreshToken();
  const now = new Date();
  const session = await createSession({
    userId, tokenHash: hashToken(refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS), lastUsedAt: now,
  });
  res.cookie("accessToken", issueAccessToken(userId, session.id), accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
};

export const refreshSession = async (
  refreshToken: string, res: Response
): Promise<PostgresSession | null> => {
  const session = await findActiveSessionByTokenHash(hashToken(refreshToken));
  if (!session) return null;
  res.cookie("accessToken", issueAccessToken(session.userId, session.id), accessCookieOptions);
  return session;
};

export const findActiveSessionById = async (
  sessionId: string, userId: string, now = new Date()
): Promise<PostgresSession | null> => findSessionById(sessionId, userId, now);

export const revokeRefreshSession = async (
  refreshToken: string | undefined
): Promise<void> => {
  if (!refreshToken) return;
  await revokeSessionByTokenHash(hashToken(refreshToken));
};

export const revokeAllSessions = async (userId: string): Promise<void> => {
  await revokeAllSessionsForUser(userId);
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie("accessToken", accessCookieOptions);
  res.clearCookie("refreshToken", refreshCookieOptions);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
  if (typeof decoded === "string") throw new Error("Invalid access token payload");
  const { userId, sessionId } = decoded;
  if (
    typeof userId !== "string" || typeof sessionId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(sessionId)
  ) throw new Error("Invalid access token payload");
  return { ...decoded, userId, sessionId };
};
