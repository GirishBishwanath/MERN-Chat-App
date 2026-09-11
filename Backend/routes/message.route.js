import express from "express";
import { getMessage, sendMessage } from "../controller/message.controller.js";
import secureRoute from "../middleware/secureRoute.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  getMessageSchema,
  sendMessageSchema,
} from "../validation/message.schemas.js";

const router = express.Router();
router.post(
  "/send/:id",
  secureRoute,
  validateRequest(sendMessageSchema),
  asyncHandler(sendMessage)
);
router.get(
  "/get/:id",
  secureRoute,
  validateRequest(getMessageSchema),
  asyncHandler(getMessage)
);

export default router;
