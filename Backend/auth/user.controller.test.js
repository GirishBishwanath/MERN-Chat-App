import test, { afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import Session from "../models/session.model.js";
import { login, logout } from "../controller/user.controller.js";
import { createUserService } from "../services/user.service.js";
import { setAuthCookies } from "../auth/session.js";

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

const createServiceRepository = () => {
  const users = new Map();

  return {
    users,
    findByEmail: async (email, includePassword = false) => {
      const user = users.get(email) ?? null;
      if (!user) return null;
      if (includePassword) return user;
      const { password: _password, ...publicUser } = user;
      return publicUser;
    },
    createUser: async (data) => {
      const user = { _id: `user-${users.size + 1}`, ...data };
      users.set(data.email, user);
      return user;
    },
    findPublicById: async (id) => {
      for (const user of users.values()) {
        if (String(user._id) === String(id)) {
          return { _id: user._id, fullname: user.fullname, email: user.email };
        }
      }
      return null;
    },
    findById: async (id) => {
      for (const user of users.values()) {
        if (String(user._id) === String(id)) return { _id: user._id };
      }
      return null;
    },
    listExcept: async () => [],
  };
};

const originals = {
  findOne: User.findOne,
  deleteOne: Session.deleteOne,
};

afterEach(() => {
  User.findOne = originals.findOne;
  Session.deleteOne = originals.deleteOne;
});

describe("authentication controllers", () => {
  test("rejects login for a nonexistent user without dereferencing it", async () => {
    User.findOne = () => ({ select: () => ({ exec: async () => null }) });

    await assert.rejects(
      () => login({ body: { email: "missing@example.com", password: "password123" } }, createResponse()),
      (error) =>
        error.statusCode === 401 &&
        error.code === "INVALID_CREDENTIALS" &&
        error.message === "Invalid user credential"
    );
  });

  test("rejects login with an invalid password", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    User.findOne = () => ({
      select: () => ({
        exec: async () => ({
          _id: "user-123",
          fullname: "Test User",
          email: "test@example.com",
          password: passwordHash,
        }),
      }),
    });

    await assert.rejects(
      () => login({ body: { email: "test@example.com", password: "wrong-password" } }, createResponse()),
      (error) =>
        error.statusCode === 401 &&
        error.code === "INVALID_CREDENTIALS" &&
        error.message === "Invalid user credential"
    );
  });

  test("creates a session on successful login", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    User.findOne = () => ({
      select: () => ({
        exec: async () => ({
          _id: "507f1f77bcf86cd799439011",
          fullname: "Test User",
          email: "test@example.com",
          password: passwordHash,
        }),
      }),
    });

    const originalSessionCreate = Session.create;
    Session.create = async (session) => session;
    const response = createResponse();

    try {
      await login(
        { body: { email: "TEST@example.com", password: "correct-password" } },
        response
      );
    } finally {
      Session.create = originalSessionCreate;
    }

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.user.email, "test@example.com");
    assert.equal(response.cookies.length, 2);
  });

  test("creates a session on successful signup", async () => {
    const repository = createServiceRepository();
    const service = createUserService(repository);
    const originalSessionCreate = Session.create;
    Session.create = async (session) => session;
    const response = createResponse();

    try {
      const user = await service.registerUser({
        fullname: " Test User ",
        email: "TEST@example.com",
        password: "password123",
        confirmPassword: "password123",
      });

      await setAuthCookies("507f1f77bcf86cd799439012", response);

      assert.equal(user.email, "test@example.com");
      assert.equal(user.fullname, "Test User");
      assert.equal(response.cookies.length, 2);
      assert.equal(repository.users.size, 1);
    } finally {
      Session.create = originalSessionCreate;
    }
  });

  test("rejects signup when passwords do not match", async () => {
    const service = createUserService(createServiceRepository());

    await assert.rejects(
      () => service.registerUser({
        fullname: "Test User",
        email: "test@example.com",
        password: "password-one",
        confirmPassword: "password-two",
      }),
      (error) =>
        error.statusCode === 400 &&
        error.code === "VALIDATION_ERROR" &&
        error.message === "Passwords do not match"
    );
  });

  test("rejects malformed signup data", async () => {
    const service = createUserService(createServiceRepository());

    await assert.rejects(
      () => service.registerUser({ email: "test@example.com" }),
      (error) => error.statusCode === 400 && error.code === "VALIDATION_ERROR"
    );
  });

  test("rejects duplicate signup with conflict status", async () => {
    const repository = createServiceRepository();
    const service = createUserService(repository);

    await service.registerUser({
      fullname: "Test User",
      email: "test@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    await assert.rejects(
      () => service.registerUser({
        fullname: "Another User",
        email: "TEST@example.com",
        password: "password123",
        confirmPassword: "password123",
      }),
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

    await logout({ cookies: { refreshToken: "refresh-token" } }, response);

    assert.equal(response.statusCode, 204);
    assert.equal(typeof deletedHash, "string");
    assert.equal(response.cleared.length, 2);
  });
});
