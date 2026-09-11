import {
  clearAuthCookies,
  revokeAllSessions,
  revokeRefreshSession,
  refreshSession,
  setAuthCookies,
} from "../auth/session.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import {
  authenticateUser,
  getPublicUser,
  getUsersExcept,
  registerUser,
  sanitizeUser,
} from "../services/user.service.js";

export const signup = async (req, res) => {
  const { fullname, email, password } = req.body;
  const user = await registerUser({ fullname, email, password });

  await setAuthCookies(user._id, res);
  return res.status(201).json({
    message: "User created successfully",
    user: sanitizeUser(user),
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await authenticateUser(email, password);

  await setAuthCookies(user._id, res);
  return res.status(200).json({
    message: "User logged in successfully",
    user: sanitizeUser(user),
  });
};

export const refresh = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
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
    if (error?.statusCode !== 404) {
      throw error;
    }

    await revokeAllSessions(session.userId);
    clearAuthCookies(res);
    throw new AppError("Session expired", 401, ERROR_CODES.SESSION_EXPIRED);
  }
};

export const me = async (req, res) =>
  res.status(200).json({ user: sanitizeUser(req.user) });

export const logout = async (req, res) => {
  await revokeRefreshSession(req.cookies.refreshToken);
  clearAuthCookies(res);
  return res.status(204).send();
};

export const logoutAll = async (req, res) => {
  await revokeAllSessions(req.user._id);
  clearAuthCookies(res);
  return res.status(204).send();
};

export const allUsers = async (req, res) => {
  const users = await getUsersExcept(req.user._id);
  return res.status(200).json(users);
};
