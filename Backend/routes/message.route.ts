import express from "express";
import { getMessage, sendMessage } from "../controller/message.controller.js";
import secureRoute from "../middleware/secureRoute.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";
import type { AuthenticatedRequest } from "../types/http.js";
import {
  getMessageSchema,
  sendMessageSchema,
} from "../validation/message.schemas.js";

const router = express.Router();

router.post(
  "/send/:id",
  secureRoute,
  validateRequest(sendMessageSchema),
  asyncHandler<AuthenticatedRequest>(sendMessage)
);
router.get(
  "/get/:id",
  secureRoute,
  validateRequest(getMessageSchema),
  asyncHandler<AuthenticatedRequest>(getMessage)
);

export default router;
