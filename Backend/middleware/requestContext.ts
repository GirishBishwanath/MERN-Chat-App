import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { incrementCounter, observeHistogram } from "../observability/metrics.js";
import { logger } from "../utils/logger.js";

const REQUEST_ID_MAX_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

const normalizeRequestId = (value: string | undefined): string =>
  value &&
  value.length <= REQUEST_ID_MAX_LENGTH &&
  REQUEST_ID_PATTERN.test(value)
    ? value
    : crypto.randomUUID();

const routeLabel = (req: Request): string =>
  typeof req.route?.path === "string" && req.route.path.length > 0
    ? req.route.path
    : "unmatched";

export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = normalizeRequestId(req.get("X-Request-Id") ?? undefined);
  req.requestId = requestId;
  res.set("X-Request-Id", requestId);

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const route = routeLabel(req);
    const status = String(res.statusCode);
    const labels = { method: req.method, route, status };

    incrementCounter("http_requests_total", labels);

    if (res.statusCode >= 500) {
      incrementCounter("http_errors_total", { method: req.method, route });
    }

    observeHistogram("http_request_duration_seconds", durationMs / 1000, labels);

    logger.info("http_request", {
      requestId,
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
};
