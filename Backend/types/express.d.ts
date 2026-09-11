import type { AuthenticatedUser } from "../services/user.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId: string;
    }
  }
}

export {};
