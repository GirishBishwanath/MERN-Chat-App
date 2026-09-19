import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, beforeEach, test } from "node:test";
import jwt from "jsonwebtoken";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";

import { config } from "../config/env.js";
import { postgresPool } from "../db/pool.js";
import { runMigrations } from "../db/migrate.js";
import { createUser } from "../repositories/postgres/user.repository.js";
import { createSession } from "../repositories/postgres/session.repository.js";
import { initializeRedisAdapter, getUserRoomName, io, server, closeSocketInfrastructure } from "./server.js";

interface SocketConnectError extends Error { data?: { code?: string }; }
let userA: string; let userB: string; let sessionA: string; let sessionB: string; let baseUrl: string;

const issueToken = (userId: string, sessionId: string, expiresIn: jwt.SignOptions["expiresIn"] = "15m"): string =>
  jwt.sign({ userId, sessionId }, config.jwtSecret, { expiresIn, algorithm: "HS256" });

const connectClient = (token?: string, query?: Record<string, string>): Promise<ClientSocket> =>
  new Promise((resolve, reject) => {
    const socket = createClient(baseUrl, {
      transports: ["websocket"],
      ...(token ? { extraHeaders: { Cookie: `accessToken=${encodeURIComponent(token)}` } } : {}),
      query, reconnection: false,
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (error: SocketConnectError) => reject(error));
  });

const expectConnectionError = async (token: string | undefined, expectedCode: string, query?: Record<string, string>): Promise<void> => {
  await assert.rejects(connectClient(token, query), (error: SocketConnectError) => {
    assert.equal(error.data?.code, expectedCode); return true;
  });
};

const waitFor = async (predicate: () => boolean, timeoutMs = 1000): Promise<void> => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) throw new Error("Timed out waiting for socket state");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const waitForOnlineUsers = (socket: ClientSocket, predicate: (ids: string[]) => boolean): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off("getOnlineUsers", onOnlineUsers); reject(new Error("Timed out waiting for getOnlineUsers")); }, 1000);
    const onOnlineUsers = (ids: string[]) => {
      if (!predicate(ids)) return;
      clearTimeout(timeout); socket.off("getOnlineUsers", onOnlineUsers); resolve(ids);
    };
    socket.on("getOnlineUsers", onOnlineUsers);
  });

before(async () => {
  await runMigrations();
  await initializeRedisAdapter();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const first = await createUser({ fullname: "Socket Test A", email: `socket-a-${suffix}@example.com`, passwordHash: "test" });
  const second = await createUser({ fullname: "Socket Test B", email: `socket-b-${suffix}@example.com`, passwordHash: "test" });
  userA = first.id; userB = second.id;
  const now = new Date();
  const firstSession = await createSession({ userId: userA, tokenHash: "a".repeat(64), expiresAt: new Date(now.getTime()+3600000), lastUsedAt: now });
  const secondSession = await createSession({ userId: userB, tokenHash: "b".repeat(64), expiresAt: new Date(now.getTime()+3600000), lastUsedAt: now });
  sessionA = firstSession.id; sessionB = secondSession.id;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => { await waitFor(() => io.sockets.sockets.size === 0); });

after(async () => {
  await waitFor(() => io.sockets.sockets.size === 0);
  await closeSocketInfrastructure();
  await postgresPool.query("DELETE FROM users WHERE id IN ($1, $2)", [userA, userB]);
  await postgresPool.end();
});

test("rejects socket connections without an access token", async () => { await expectConnectionError(undefined, "AUTH_REQUIRED"); });

test("rejects invalid and expired access tokens with distinct auth errors", async () => {
  await expectConnectionError("not-a-jwt", "AUTH_INVALID");
  await expectConnectionError(issueToken(userA, sessionA, -1), "AUTH_EXPIRED");
});

test("authenticates from the access cookie and ignores client identity query parameters", async () => {
  const socket = await connectClient(issueToken(userA, sessionA), { userId: userB });
  try {
    const serverSocket = io.sockets.sockets.get(socket.id); assert.ok(serverSocket);
    assert.equal(serverSocket.data.userId, userA);
    assert.ok(io.sockets.adapter.rooms.get(getUserRoomName(userA))?.has(socket.id));
    assert.equal(io.sockets.adapter.rooms.get(getUserRoomName(userB))?.has(socket.id) ?? false, false);
  } finally { socket.close(); }
});

test("keeps a user online until the final socket disconnects", async () => {
  const socketA1 = await connectClient(issueToken(userA, sessionA));
  const socketA2 = await connectClient(issueToken(userA, sessionA));
  const observer = await connectClient(issueToken(userB, sessionB));
  let sawPrematureOffline = false;
  const onOnlineUsers = (ids: string[]) => { if (!ids.includes(userA)) sawPrematureOffline = true; };
  observer.on("getOnlineUsers", onOnlineUsers);
  try {
    assert.equal(io.sockets.adapter.rooms.get(getUserRoomName(userA))?.size, 2);
    socketA1.disconnect();
    await waitFor(() => (io.sockets.adapter.rooms.get(getUserRoomName(userA))?.size ?? 0) === 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(sawPrematureOffline, false);
    const finalOffline = waitForOnlineUsers(observer, (ids) => !ids.includes(userA));
    socketA2.disconnect();
    await finalOffline;
  } finally {
    observer.off("getOnlineUsers", onOnlineUsers); socketA1.close(); socketA2.close(); observer.close();
  }
});

test("re-authenticates a new socket on reconnect instead of reusing client identity", async () => {
  const socket = await connectClient(issueToken(userA, sessionA));
  try {
    const firstSocketId = socket.id; assert.ok(firstSocketId);
    socket.io.opts.extraHeaders = { Cookie: `accessToken=${encodeURIComponent(issueToken(userB, sessionB))}` };
    socket.disconnect(); socket.connect();
    await once(socket, "connect");
    assert.notEqual(socket.id, firstSocketId);
    assert.ok(io.sockets.adapter.rooms.get(getUserRoomName(userB))?.has(socket.id));
    assert.equal(io.sockets.adapter.rooms.get(getUserRoomName(userA))?.has(socket.id) ?? false, false);
  } finally { socket.close(); }
});
