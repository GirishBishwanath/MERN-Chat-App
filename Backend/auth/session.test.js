import test, { afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { verifyAccessToken, clearAuthCookies } from "./session.js";
import secureRoute from "../middleware/secureRoute.js";
import User from "../models/user.model.js";

process.env.JWT_SECRET = "test-only-auth-secret";

describe("access authentication", () => {
  const originalFindById = User.findById;

  afterEach(() => {
    User.findById = originalFindById;
  });

  test("verifies a valid access token", () => {
    const token = jwt.sign({ userId: "user-123" }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    const payload = verifyAccessToken(token);
    assert.equal(payload.userId, "user-123");
  });

  test("rejects an expired access token", () => {
    const token = jwt.sign({ userId: "user-123" }, process.env.JWT_SECRET, {
      expiresIn: -1,
    });

    assert.throws(() => verifyAccessToken(token), { name: "TokenExpiredError" });
  });

  test("rejects requests without an access cookie", async () => {
    const response = createResponse();
    await secureRoute({ cookies: {} }, response, () => {
      throw new Error("next should not be called");
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { error: "Authentication required" });
  });

  test("accepts a valid access session and attaches the user", async () => {
    const user = { _id: "user-123", fullname: "Test User", email: "test@example.com" };
    User.findById = () => ({ select: async () => user });

    const token = jwt.sign({ userId: "user-123" }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });
    const req = { cookies: { accessToken: token } };
    const response = createResponse();
    let nextCalled = false;

    await secureRoute(req, response, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.user, user);
  });

  test("clears both authentication cookies with secure attributes", () => {
    const response = createResponse();
    clearAuthCookies(response);

    assert.equal(response.cleared.length, 2);
    assert.equal(response.cleared[0][0], "accessToken");
    assert.equal(response.cleared[1][0], "refreshToken");
    assert.equal(response.cleared[0][1].httpOnly, true);
    assert.equal(response.cleared[1][1].httpOnly, true);
  });
});

const createResponse = () => ({
  statusCode: null,
  body: null,
  cleared: [],
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  clearCookie(name, options) {
    this.cleared.push([name, options]);
    return this;
  },
});
