import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import {
  clearAuthCookies,
  revokeAllSessions,
  revokeRefreshSession,
  rotateRefreshSession,
  setAuthCookies,
} from "../auth/session.js";

const sanitizeUser = (user) => ({
  _id: user._id,
  fullname: user.fullname,
  email: user.email,
});

const normalizeEmail = (email) => email.trim().toLowerCase();

const validateCredentials = (email, password) =>
  typeof email === "string" &&
  email.trim().length > 0 &&
  typeof password === "string" &&
  password.length > 0;

export const signup = async (req, res) => {
  const { fullname, email, password, confirmPassword } = req.body;

  try {
    if (
      typeof fullname !== "string" ||
      fullname.trim().length < 2 ||
      !validateCredentials(email, password) ||
      typeof confirmPassword !== "string"
    ) {
      return res.status(400).json({ error: "Invalid signup data" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: "User already registered" });
    }

    const hashPassword = await bcrypt.hash(password, 12);
    const newUser = await User.create({
      fullname: fullname.trim(),
      email: normalizedEmail,
      password: hashPassword,
    });

    await setAuthCookies(newUser._id, res);

    return res.status(201).json({
      message: "User created successfully",
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    console.error("Error in signup controller:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!validateCredentials(email, password)) {
      return res.status(400).json({ error: "Invalid user credential" });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.status(401).json({ error: "Invalid user credential" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid user credential" });
    }

    await setAuthCookies(user._id, res);

    return res.status(200).json({
      message: "User logged in successfully",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Error in login controller:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: "Session expired" });
    }

    const session = await rotateRefreshSession(refreshToken, res);
    if (!session) {
      clearAuthCookies(res);
      return res.status(401).json({ error: "Session expired" });
    }

    const user = await User.findById(session.userId).select("_id fullname email");
    if (!user) {
      await revokeAllSessions(session.userId);
      clearAuthCookies(res);
      return res.status(401).json({ error: "Session expired" });
    }

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("Error in refresh controller:", error);
    clearAuthCookies(res);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const me = async (req, res) => {
  return res.status(200).json({ user: sanitizeUser(req.user) });
};

export const logout = async (req, res) => {
  try {
    await revokeRefreshSession(req.cookies.refreshToken);
    clearAuthCookies(res);
    return res.status(204).send();
  } catch (error) {
    console.error("Error in logout controller:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const logoutAll = async (req, res) => {
  try {
    await revokeAllSessions(req.user._id);
    clearAuthCookies(res);
    return res.status(204).send();
  } catch (error) {
    console.error("Error in logout-all controller:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const allUsers = async (req, res) => {
  try {
    const loggedInUser = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUser },
    }).select("-password -confirmPassword");
    return res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in allUsers controller:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
