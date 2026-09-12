import express from "express";
import {
  allUsers,
  login,
  logout,
  logoutAll,
  me,
  refresh,
  signup,
} from "../controller/user.controller.js";
import secureRoute from "../middleware/secureRoute.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";
import type { AuthenticatedRequest } from "../types/http.js";
import { loginSchema, signupSchema } from "../validation/user.schemas.js";

const router = express.Router();

router.post("/signup", validateRequest(signupSchema), asyncHandler(signup));
router.post("/login", validateRequest(loginSchema), asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
router.post(
  "/logout-all",
  secureRoute,
  asyncHandler<AuthenticatedRequest>(logoutAll)
);
router.get("/me", secureRoute, asyncHandler<AuthenticatedRequest>(me));
router.get(
  "/allusers",
  secureRoute,
  asyncHandler<AuthenticatedRequest>(allUsers)
);

export default router;
