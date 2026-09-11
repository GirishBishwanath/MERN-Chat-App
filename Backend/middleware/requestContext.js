import crypto from "node:crypto";
import { logger } from "../utils/logger.js";

export const requestContext = (req, res, next) => {
  const requestId = req.get("X-Request-Id") || crypto.randomUUID();
  req.requestId = requestId;
  res.set("X-Request-Id", requestId);

  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info("http_request", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
};
