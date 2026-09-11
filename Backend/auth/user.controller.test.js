import test, { afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import Session from "../models/session.model.js";
import { login, logout, signup } from "../controller/user.controller.js";

process.env.JWT_SECRET = "test-only-auth-secret";

describe("authentication controllers", () => {
  const originals = {
    findOne: User.findOne,
    create: User.create,
    deleteOne: Session.deleteOne,
    sessionCreate: Session.create,
  };

  afterEach(() => {
    User.findOne = originals.findOne;
    User.create = originals.create;
    Session.deleteOne = originals.deleteOne;
    Session.create = originals.sessionCreate;
  });

  test("rejects login for a nonexistent user without dereferencing it", async () => {
    User.findOne = () => ({ select: async () => null });
    const response = createResponse();

    await login(
      { body: { email: "missing@example.com", password: "password" } },
      response
    );

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { error: "Invalid user credential" });
  });

  test("rejects login with an invalid password", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    User.findOne = () => ({
      select: async () => ({
        _id: "user-123",
        fullname: "Test User",
        email: "test@example.com",
        password: passwordHash,
      }),
    });
    const response = createResponse();

    await login(
      { body: { email: "test@example.com", password: "wrong-password" } },
      response
    );

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { error: "Invalid user credential" });
  });

  test("creates a session on successful login", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    User.findOne = () => ({
      select: async () => ({
        _id: "user-123",
        fullname: "Test User",
        email: "test@example.com",
        password: passwordHash,
      }),
    });
    Session.create = async (session) => session;
    const response = createResponse();

    await login(
      { body: { email: "TEST@example.com", password: "correct-password" } },
      response
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.user.email, "test@example.com");
    assert.equal(response.cookies.length, 2);
    assert.equal(response.cookies[0][0], "accessToken");
    assert.equal(response.cookies[1][0], "refreshToken");
  });

  test("creates a session on successful signup", async () => {
    User.findOne = async () => null;
    User.create = async (data) => ({
      _id: "user-456",
      fullname: data.fullname,
      email: data.email,
      password: data.password,
    });
    Session.create = async (session) => session;
    const response = createResponse();

    await signup(
      {
        body: {
          fullname: " Test User ",
          email: "TEST@example.com",
          password: "password",
          confirmPassword: "password",
        },
      },
      response
    );

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.user.email, "test@example.com");
    assert.equal(response.body.user.fullname, "Test User");
    assert.equal(response.cookies.length, 2);
  });

  test("rejects signup when passwords do not match", async () => {
    const response = createResponse();

    await signup(
      {
        body: {
          fullname: "Test User",
          email: "test@example.com",
          password: "one",
          confirmPassword: "two",
        },
      },
      response
    ).catch((error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.message, "Passwords do not match");
    });
  });

  test("rejects malformed signup data", async () => {
    await assert.rejects(
      () => signup({ body: { email: "test@example.com" } }, createResponse()),
      (error) => error.statusCode === 400 && error.code === "VALIDATION_ERROR"
    );
  });

  test("rejects duplicate signup with conflict status", async () => {
    User.findOne = async () => ({ _id: "existing-user" });

    await assert.rejects(
      () =>
        signup(
          {
            body: {
              fullname: "Test User",
              email: "TEST@example.com",
              password: "password",
              confirmPassword: "password",
            },
          },
          createResponse()
        ),
      (error) =>
        error.statusCode === 409 &&
        error.code === "CONFLICT" &&
        error.message === "User already registered"
    );
  });

  test("revokes the refresh session during logout", async () => {
    let deletedHash = null;
    Session.deleteOne = async (query) => {
      deletedHash = query.tokenHash;
      return { acknowledged: true };
    };
    const response = createResponse();

    await logout(
      { cookies: { refreshToken: "refresh-token" } },
      response
    );

    assert.equal(response.statusCode, 204);
    assert.equal(typeof deletedHash, "string");
    assert.equal(response.cleared.length, 2);
  });
});

const createResponse = () => ({
  statusCode: null,
  body: null,
  cookies: [],
  cleared: [],
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  send() {
    return this;
  },
  cookie(name, value, options) {
    this.cookies.push([name, value, options]);
    return this;
  },
  clearCookie(name, options) {
    this.cleared.push([name, options]);
    return this;
  },
});
