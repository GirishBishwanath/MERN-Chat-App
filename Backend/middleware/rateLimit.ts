import crypto from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { getRedisClient } from "../infra/redis/client.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import { logger } from "../utils/logger.js";

const INCREMENT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

export interface RateLimitOptions {
  name: string;
  limit: number;
  windowSeconds: number;
  key: (req: Request) => string;
}

export interface RateLimitRedisClient {
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] }
  ): Promise<unknown>;
}

const digest = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

export const createRedisRateLimiter = (
  options: RateLimitOptions,
  client: RateLimitRedisClient = getRedisClient()
): RequestHandler => (req: Request, res: Response, next: NextFunction): void => {
  const rawKey = options.key(req).trim().toLowerCase() || "anonymous";
  const key = `chatapp:ratelimit:${options.name}:${digest(rawKey)}`;

  void client
    .eval(INCREMENT_SCRIPT, {
      keys: [key],
      arguments: [String(options.windowSeconds)],
    })
    .then((result) => {
      const count = Number(result);

      if (!Number.isFinite(count)) {
        throw new Error("Redis returned an invalid rate-limit counter");
      }

      res.setHeader("RateLimit-Limit", String(options.limit));
      res.setHeader(
        "RateLimit-Reset",
        String(Math.floor(Date.now() / 1000) + options.windowSeconds)
      );

      if (count > options.limit) {
        res.setHeader("Retry-After", String(options.windowSeconds));
        next(
          new AppError("Too many requests", 429, ERROR_CODES.RATE_LIMITED)
        );
        return;
      }

      next();
    })
    .catch((error: unknown) => {
      logger.error("rate_limit_unavailable", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      next(
        new AppError(
          "Request security control unavailable",
          503,
          ERROR_CODES.RATE_LIMIT_UNAVAILABLE
        )
      );
    });
};

export const credentialRateLimitKey = (req: Request): string => {
  const email =
    typeof req.body === "object" &&
    req.body !== null &&
    "email" in req.body &&
    typeof req.body.email === "string"
      ? req.body.email
      : "anonymous";

  return email.trim().toLowerCase();
};
