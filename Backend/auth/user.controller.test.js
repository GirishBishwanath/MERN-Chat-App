import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { createUserService } from "../services/user.service.js";

const createServiceRepository = () => {
  const users = new Map();
  return {
    users,
    findByEmail: async (email, includePassword = false) => {
      const user = users.get(email) ?? null;
      if (!user) return null;
      return includePassword ? user : { ...user, password: undefined };
    },
    createUser: async (data) => {
      const user = { _id: `user-${users.size + 1}`, ...data };
      users.set(data.email, user);
      return user;
    },
    findPublicById: async (id) => {
      for (const user of users.values()) {
        if (user._id === id) return { _id: user._id, fullname: user.fullname, email: user.email };
      }
      return null;
    },
    findById: async (id) => users.has(id) ? { _id: id } : null,
    listExcept: async () => [],
  };
};

describe("authentication service", () => {
  test("rejects login for a nonexistent user", async () => {
    const service = createUserService(createServiceRepository());
    await assert.rejects(
      () => service.authenticateUser("missing@example.com", "password123"),
      (error) => error.statusCode === 401 && error.code === "INVALID_CREDENTIALS"
    );
  });

  test("creates and authenticates a user", async () => {
    const repository = createServiceRepository();
    const service = createUserService(repository);
    const user = await service.registerUser({
      fullname: " Test User ", email: "TEST@example.com",
      password: "password123", confirmPassword: "password123",
    });
    assert.equal(user.email, "test@example.com");
    const authenticated = await service.authenticateUser("TEST@example.com", "password123");
    assert.equal(authenticated._id, user._id);
  });

  test("rejects invalid password", async () => {
    const service = createUserService(createServiceRepository());
    await service.registerUser({
      fullname: "Test User", email: "test@example.com",
      password: "correct-password", confirmPassword: "correct-password",
    });
    await assert.rejects(
      () => service.authenticateUser("test@example.com", "wrong-password"),
      (error) => error.statusCode === 401 && error.code === "INVALID_CREDENTIALS"
    );
  });

  test("rejects mismatched signup passwords", async () => {
    const service = createUserService(createServiceRepository());
    await assert.rejects(
      () => service.registerUser({
        fullname: "Test User", email: "test@example.com",
        password: "password-one", confirmPassword: "password-two",
      }),
      (error) => error.statusCode === 400 && error.code === "VALIDATION_ERROR"
    );
  });

  test("rejects duplicate signup", async () => {
    const service = createUserService(createServiceRepository());
    const input = {
      fullname: "Test User", email: "test@example.com",
      password: "password123", confirmPassword: "password123",
    };
    await service.registerUser(input);
    await assert.rejects(
      () => service.registerUser({ ...input, fullname: "Another User" }),
      (error) => error.statusCode === 409 && error.code === "CONFLICT"
    );
  });
});
