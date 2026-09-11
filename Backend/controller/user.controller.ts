import type { Request, Response } from "express";

import {
  clearAuthCookies,
  refreshSession,
  revokeAllSessions,
  revokeRefreshSession,
  setAuthCookies,
} from "../auth/session.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import type { AuthenticatedRequest } from "../types/http.js";
import {
  authenticateUser,
  getPublicUser,
  getUsersExcept,
  registerUser,
  sanitizeUser,
  type RegisterUserInput,
} from "../services/user.service.js";

export const signup = async (req: Request, res: Response): Promise<Response> => {
  const input = req.body as RegisterUserInput;
  const user = await registerUser(input);

  await setAuthCookies(user._id, res);
  return res.status(201).json({
    message: "User created successfully",
    user: sanitizeUser(user),
  });
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body as { email: string; password: string };
  const user = await authenticateUser(email, password);

  await setAuthCookies(user._id, res);
  return res.status(200).json({
    message: "User logged in successfully",
    user: sanitizeUser(user),
  });
};

export const refresh = async (req: Request, res: Response): Promise<Response> => {
  const refreshToken = req.cookies.refreshToken;
  if (typeof refreshToken !== "string") {
    throw new AppError("Session expired", 401, ERROR_CODES.SESSION_EXPIRED);
  }

  const session = await refreshSession(refreshToken, res);
  if (!session) {
    clearAuthCookies(res);
    throw new AppError("Session expired", 401, ERROR_CODES.SESSION_EXPIRED);
  }

  try {
    const user = await getPublicUser(session.userId);
    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    if (!(error instanceof AppError) || error.statusCode !== 404) {
      throw error;
    }

    await revokeAllSessions(session.userId);
    clearAuthCookies(res);
    throw new AppError("Session expired", 401, ERROR_CODES.SESSION_EXPIRED);
  }
};

export const me = (
  req: AuthenticatedRequest,
  res: Response
): Response => res.status(200).json({ user: sanitizeUser(req.user) });

export const logout = async (req: Request, res: Response): Promise<Response> => {
  await revokeRefreshSession(req.cookies.refreshToken);
  clearAuthCookies(res);
  return res.status(204).send();
};

export const logoutAll = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  await revokeAllSessions(req.user._id);
  clearAuthCookies(res);
  return res.status(204).send();
};

export const allUsers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  const users = await getUsersExcept(req.user._id);
  return res.status(200).json(users);
};
