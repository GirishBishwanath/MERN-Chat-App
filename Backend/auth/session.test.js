import test, { describe } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { verifyAccessToken, clearAuthCookies } from "./session.js";
import secureRoute from "../middleware/secureRoute.js";

process.env.JWT_SECRET = "test-only-auth-secret";

const userId = "507f1f77bcf86cd799439011";
const sessionId = "507f1f77bcf86cd799439012";

describe("access authentication", () => {
  test("verifies a valid session-bound access token", () => {
    const token = jwt.sign(
      { userId, sessionId },
      process.env.JWT_SECRET,
      { expiresIn: "15m", algorithm: "HS256" }
    );

    const payload = verifyAccessToken(token);
    assert.equal(payload.userId, userId);
    assert.equal(payload.sessionId, sessionId);
  });

  test("rejects an expired access token", () => {
    const token = jwt.sign(
      { userId, sessionId },
      process.env.JWT_SECRET,
      { expiresIn: -1, algorithm: "HS256" }
    );

    assert.throws(() => verifyAccessToken(token), { name: "TokenExpiredError" });
  });

  test("rejects access tokens without a valid session id", () => {
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: "15m", algorithm: "HS256" }
    );

    assert.throws(() => verifyAccessToken(token));
  });

  test("rejects requests without an access cookie", async () => {
    const response = createResponse();
    await secureRoute({ cookies: {} }, response, () => {
      throw new Error("next should not be called");
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { error: "Authentication required" });
  });

  test("rejects a signed token whose backing session has been revoked", async () => {
    const token = jwt.sign(
      { userId, sessionId },
      process.env.JWT_SECRET,
      { expiresIn: "15m", algorithm: "HS256" }
    );
    const response = createResponse();

    let nextError;
    await secureRoute(
      { cookies: { accessToken: token } },
      response,
      (error) => {
        nextError = error;
      },
      {
        findSession: async () => null,
        findUser: async () => ({
          _id: userId,
          fullname: "Test User",
          email: "test@example.com",
        }),
      }
    );

    assert.equal(nextError?.code, "UNAUTHENTICATED");
  });

  test("accepts a valid access session and attaches the user", async () => {
    const user = { _id: userId, fullname: "Test User", email: "test@example.com" };
    const token = jwt.sign(
      { userId, sessionId },
      process.env.JWT_SECRET,
      { expiresIn: "15m", algorithm: "HS256" }
    );
    const req = { cookies: { accessToken: token } };
    const response = createResponse();
    let nextCalled = false;

    await secureRoute(
      req,
      response,
      () => {
        nextCalled = true;
      },
      {
        findSession: async () => ({ _id: sessionId }),
        findUser: async () => user,
      }
    );

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
