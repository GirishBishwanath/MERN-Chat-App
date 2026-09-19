import test, { describe } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { verifyAccessToken, clearAuthCookies } from "./session.js";
import secureRoute from "../middleware/secureRoute.js";

process.env.JWT_SECRET = "test-only-auth-secret";
const userId = "00000000-0000-4000-8000-000000000001";
const sessionId = "00000000-0000-4000-8000-000000000002";

const createResponse = () => ({
  statusCode: null, body: null, cookies: [], cleared: [],
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  send() { return this; },
  cookie(name, value, options) { this.cookies.push([name, value, options]); return this; },
  clearCookie(name, options) { this.cleared.push([name, options]); return this; },
});

describe("access authentication", () => {
  test("verifies a valid session-bound access token", () => {
    const token = jwt.sign({ userId, sessionId }, process.env.JWT_SECRET, { expiresIn: "15m", algorithm: "HS256" });
    const payload = verifyAccessToken(token);
    assert.equal(payload.userId, userId); assert.equal(payload.sessionId, sessionId);
  });
  test("rejects an expired access token", () => {
    const token = jwt.sign({ userId, sessionId }, process.env.JWT_SECRET, { expiresIn: -1, algorithm: "HS256" });
    assert.throws(() => verifyAccessToken(token), { name: "TokenExpiredError" });
  });
  test("rejects malformed authentication tokens as invalid authentication", () => {
    const token = jwt.sign({ userId: "not-a-uuid", sessionId }, process.env.JWT_SECRET, { expiresIn: "15m", algorithm: "HS256" });
    assert.throws(() => verifyAccessToken(token));
  });
  test("rejects access tokens without a valid session id", () => {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "15m", algorithm: "HS256" });
    assert.throws(() => verifyAccessToken(token));
  });
  test("rejects requests without an access cookie", async () => {
    let nextError;
    await secureRoute({ cookies: {} }, createResponse(), (error) => { nextError = error; });
    assert.equal(nextError?.statusCode, 401);
    assert.equal(nextError?.code, "UNAUTHENTICATED");
    assert.equal(nextError?.message, "Authentication required");
  });
  test("rejects a signed token whose backing session has been revoked", async () => {
    const token = jwt.sign({ userId, sessionId }, process.env.JWT_SECRET, { expiresIn: "15m", algorithm: "HS256" });
    let nextError;
    await secureRoute({ cookies: { accessToken: token } }, createResponse(), (error) => { nextError = error; }, {
      findSession: async () => null,
      findUser: async () => ({ _id: userId, fullname: "Test User", email: "test@example.com" }),
    });
    assert.equal(nextError?.code, "UNAUTHENTICATED");
  });
  test("accepts a valid access session and attaches the user", async () => {
    const user = { _id: userId, fullname: "Test User", email: "test@example.com" };
    const token = jwt.sign({ userId, sessionId }, process.env.JWT_SECRET, { expiresIn: "15m", algorithm: "HS256" });
    const req = { cookies: { accessToken: token } }; let nextCalled = false;
    await secureRoute(req, createResponse(), () => { nextCalled = true; }, {
      findSession: async () => ({ id: sessionId }), findUser: async () => user,
    });
    assert.equal(nextCalled, true); assert.deepEqual(req.user, user);
  });
});
