import assert from "node:assert/strict";
import test from "node:test";

import type { NextFunction, Request, Response } from "express";

import { ERROR_CODES } from "../errors/errorCodes.js";
import { createRedisRateLimiter } from "./rateLimit.js";
import { securityHeaders } from "./securityHeaders.js";
import { verifyRequestOrigin } from "./verifyOrigin.js";

const createResponse = () => {
  const headers = new Map<string, string>();

  return {
    headers,
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return this;
    },
  } as unknown as Response & { headers: Map<string, string> };
};

const runMiddleware = (
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  req: Partial<Request>
): { error?: unknown; response: Response & { headers: Map<string, string> } } => {
  const response = createResponse();
  let error: unknown;

  middleware(req as Request, response, (nextError?: unknown) => {
    error = nextError;
  });

  return { error, response };
};

test("blocks unsafe requests with an untrusted origin", () => {
  const result = runMiddleware(verifyRequestOrigin, {
    method: "POST",
    get: (name: string) =>
      name === "Origin" ? "https://attacker.example" : undefined,
  });

  assert.equal((result.error as { code?: string })?.code, ERROR_CODES.CSRF_BLOCKED);
});

test("accepts unsafe requests from a configured origin", () => {
  const result = runMiddleware(verifyRequestOrigin, {
    method: "POST",
    get: (name: string) =>
      name === "Origin" ? "http://localhost:3001" : undefined,
  });

  assert.equal(result.error, undefined);
});

test("rejects unsafe requests when neither Origin nor Referer is supplied", () => {
  const result = runMiddleware(verifyRequestOrigin, {
    method: "POST",
    get: () => undefined,
  });

  assert.equal((result.error as { code?: string })?.code, ERROR_CODES.CSRF_BLOCKED);
});

test("does not require an Origin header for safe methods", () => {
  const result = runMiddleware(verifyRequestOrigin, {
    method: "GET",
    get: () => undefined,
  });

  assert.equal(result.error, undefined);
});

test("sets API security headers", () => {
  const result = runMiddleware(securityHeaders, { method: "GET" });

  assert.equal(result.error, undefined);
  assert.equal(result.response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(result.response.headers.get("X-Frame-Options"), "DENY");
  assert.equal(
    result.response.headers.get("Referrer-Policy"),
    "strict-origin-when-cross-origin"
  );
  assert.equal(
    result.response.headers.get("Permissions-Policy"),
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
});

test("rate limits repeated credential attempts", async () => {
  let count = 0;
  const client = {
    eval: async () => {
      count += 1;
      return count;
    },
  };

  const middleware = createRedisRateLimiter(
    {
      name: "login-test",
      limit: 2,
      windowSeconds: 900,
      key: () => "user@example.com",
    },
    client
  );

  const nextCalls: unknown[] = [];
  const request = { body: { email: "User@example.com" } } as Request;
  const response = {
    setHeader() {
      return this;
    },
  } as unknown as Response;

  middleware(request, response, (error) => nextCalls.push(error));
  await new Promise((resolve) => setImmediate(resolve));
  middleware(request, response, (error) => nextCalls.push(error));
  await new Promise((resolve) => setImmediate(resolve));
  middleware(request, response, (error) => nextCalls.push(error));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(nextCalls.filter(Boolean).length, 1);
  assert.equal(
    (nextCalls.find(Boolean) as { code?: string })?.code,
    ERROR_CODES.RATE_LIMITED
  );
});
