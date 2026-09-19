import type { Request } from "express";
import type { AuthenticatedUser } from "../services/user.service.js";

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };
