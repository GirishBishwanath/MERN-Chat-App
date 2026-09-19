import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_EMAIL_LENGTH,
  MAX_FULLNAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  loginSchema,
  signupSchema,
} from "./user.schemas.js";

const request = (body: Record<string, unknown>) =>
  ({ body }) as never;

test("accepts bounded authentication input", () => {
  const result = signupSchema(
    request({
      fullname: "Test User",
      email: "test@example.com",
      password: "password123",
      confirmPassword: "password123",
    })
  );

  assert.equal(result.valid, true);
});

test("rejects oversized authentication fields", () => {
  const result = signupSchema(
    request({
      fullname: "x".repeat(MAX_FULLNAME_LENGTH + 1),
      email: "x".repeat(MAX_EMAIL_LENGTH - 10) + "@example.com",
      password: "x".repeat(MAX_PASSWORD_LENGTH + 1),
      confirmPassword: "x".repeat(MAX_PASSWORD_LENGTH + 1),
    })
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.fullname);
  assert.ok(result.errors.email);
  assert.ok(result.errors.password);
  assert.ok(result.errors.confirmPassword);
});

test("rejects oversized login passwords before bcrypt", () => {
  const result = loginSchema(
    request({
      email: "test@example.com",
      password: "x".repeat(MAX_PASSWORD_LENGTH + 1),
    })
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.password);
});
