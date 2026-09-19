import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-auth-secret";
process.env.CORS_ORIGINS = "http://localhost:3001";
process.env.POSTGRES_HOST = "127.0.0.1";
process.env.POSTGRES_PORT = "5432";
process.env.POSTGRES_DATABASE = "mern_chat_app_test";
process.env.POSTGRES_USER = "postgres";
process.env.POSTGRES_PASSWORD = "postgres";
process.env.POSTGRES_SSL = "false";
process.env.REDIS_URL = "redis://127.0.0.1:6379/15";

const { app } = await import("../app.js");
const { postgresPool } = await import("../db/pool.js");
const { runMigrations } = await import("../db/migrate.js");
const { initializeRedisAdapter, closeSocketInfrastructure } = await import("../SocketIO/server.js");

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const alice = {
  fullname: "API Test Alice",
  email: `api-alice-${suffix}@example.com`,
  password: "CorrectHorseBatteryStaple",
  confirmPassword: "CorrectHorseBatteryStaple",
};
const bob = {
  fullname: "API Test Bob",
  email: `api-bob-${suffix}@example.com`,
  password: "CorrectHorseBatteryStaple",
  confirmPassword: "CorrectHorseBatteryStaple",
};

let server: http.Server;
let baseUrl: string;

const cookieHeader = (response: Response): string => {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.() ?? [];
  if (values.length > 0) {
    return values.map((value) => value.split(";", 1)[0]).join("; ");
  }
  const value = response.headers.get("set-cookie");
  return value ? value.split(/, (?=[^;]+=)/).map((part) => part.split(";", 1)[0]).join("; ") : "";
};

const request = async (
  path: string,
  init: RequestInit = {},
  cookies = ""
): Promise<Response> => {
  const headers = new Headers(init.headers);
  headers.set("Origin", "http://localhost:3001");
  if (cookies) headers.set("Cookie", cookies);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
};

const json = (value: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});

before(async () => {
  await runMigrations();
  await initializeRedisAdapter();
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await postgresPool.query("DELETE FROM users WHERE email IN ($1, $2)", [alice.email, bob.email]);
  await closeSocketInfrastructure();
  await postgresPool.end();
});

test("signup establishes an authenticated session and /me is protected by that session", async () => {
  const signupResponse = await request("/api/user/signup", json(alice));
  assert.equal(signupResponse.status, 201);
  const signupBody = await signupResponse.json() as { user: { email: string } };
  assert.equal(signupBody.user.email, alice.email);

  const cookies = cookieHeader(signupResponse);
  assert.match(cookies, /accessToken=/);
  assert.match(cookies, /refreshToken=/);

  const meResponse = await request("/api/user/me", { method: "GET" }, cookies);
  assert.equal(meResponse.status, 200);
  const meBody = await meResponse.json() as { user: { email: string } };
  assert.equal(meBody.user.email, alice.email);
});

test("duplicate signup is rejected by the application/database contract", async () => {
  const firstResponse = await request("/api/user/signup", json(bob));
  assert.equal(firstResponse.status, 201);

  const response = await request("/api/user/signup", json(bob));
  assert.equal(response.status, 409);
  const body = await response.json() as { code: string };
  assert.equal(body.code, "CONFLICT");
});

test("state-changing requests without a trusted origin are blocked before route handling", async () => {
  const response = await fetch(`${baseUrl}/api/user/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
  });
  assert.equal(response.status, 403);
  const body = await response.json() as { code: string };
  assert.equal(body.code, "CSRF_BLOCKED");
});

test("logout revokes the authenticated session and protected access stops working", async () => {
  const loginResponse = await request("/api/user/login", json({
    email: alice.email,
    password: alice.password,
  }));
  assert.equal(loginResponse.status, 200);
  const cookies = cookieHeader(loginResponse);

  const beforeLogout = await request("/api/user/me", { method: "GET" }, cookies);
  assert.equal(beforeLogout.status, 200);

  const logoutResponse = await request("/api/user/logout", { method: "POST" }, cookies);
  assert.equal(logoutResponse.status, 204);

  const afterLogout = await request("/api/user/me", { method: "GET" }, cookies);
  assert.equal(afterLogout.status, 401);
});

test("malformed message requests are rejected at the API boundary", async () => {
  const loginResponse = await request("/api/user/login", json({
    email: alice.email,
    password: alice.password,
  }));
  const cookies = cookieHeader(loginResponse);

  const response = await request("/api/message/send/not-a-uuid", json({ message: "hello" }), cookies);
  assert.equal(response.status, 400);
  const body = await response.json() as { code: string };
  assert.equal(body.code, "VALIDATION_ERROR");
});
