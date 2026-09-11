import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../errors/errorCodes.js";
import { errorHandler } from "./errorHandler.js";
import { validateRequest } from "./validateRequest.js";
import { loginSchema, signupSchema } from "../validation/user.schemas.js";

const createResponse = () => ({
  statusCode: null,
  body: null,
  headers: {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  set(name, value) {
    this.headers[name] = value;
    return this;
  },
});

describe("request validation", () => {
  test("rejects malformed signup requests", () => {
    let nextError;
    validateRequest(signupSchema)({ body: { email: "bad" } }, {}, (error) => {
      nextError = error;
    });

    assert.equal(nextError.statusCode, 400);
    assert.equal(nextError.code, ERROR_CODES.VALIDATION_ERROR);
    assert.ok(nextError.details.email);
  });

  test("accepts valid login requests", () => {
    let called = false;
    validateRequest(loginSchema)(
      { body: { email: "user@example.com", password: "password" } },
      {},
      () => {
        called = true;
      }
    );

    assert.equal(called, true);
  });
});

describe("error mapping", () => {
  test("returns stable AppError responses", () => {
    const response = createResponse();
    errorHandler(
      new AppError("Forbidden", 403, ERROR_CODES.FORBIDDEN),
      { requestId: "req-123", method: "GET", originalUrl: "/private" },
      response,
      () => {}
    );

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.body, {
      error: "Forbidden",
      code: ERROR_CODES.FORBIDDEN,
      requestId: "req-123",
    });
  });

  test("maps duplicate-key database errors to conflict", () => {
    const response = createResponse();
    errorHandler(
      { code: 11000 },
      { requestId: "req-456", method: "POST", originalUrl: "/api/user/signup" },
      response,
      () => {}
    );

    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, ERROR_CODES.CONFLICT);
  });
});
