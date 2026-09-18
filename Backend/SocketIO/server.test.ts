import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, beforeEach, test } from "node:test";

import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";

import { config } from "../config/env.js";
import User from "../models/user.model.js";
import Session from "../models/session.model.js";
import { initializeRedisAdapter, getUserRoomName, io, server, closeSocketInfrastructure } from "./server.js";

interface SocketConnectError extends Error {
  data?: {
    code?: string;
  };
}

const TEST_EMAIL_PREFIX = "socket-test-";

let userA: { _id: mongoose.Types.ObjectId };
let userB: { _id: mongoose.Types.ObjectId };
let sessionA: mongoose.Types.ObjectId;
let sessionB: mongoose.Types.ObjectId;
let baseUrl: string;

const issueToken = (
  userId: mongoose.Types.ObjectId,
  sessionId: mongoose.Types.ObjectId,
  expiresIn: jwt.SignOptions["expiresIn"] = "15m"
): string =>
  jwt.sign(
    { userId: userId.toString(), sessionId: sessionId.toString() },
    config.jwtSecret,
    { expiresIn, algorithm: "HS256" }
  );

const connectClient = (
  token?: string,
  query?: Record<string, string>
): Promise<ClientSocket> =>
  new Promise((resolve, reject) => {
    const socket = createClient(baseUrl, {
      transports: ["websocket"],
      ...(token
        ? { extraHeaders: { Cookie: `accessToken=${encodeURIComponent(token)}` } }
        : {}),
      query,
      reconnection: false,
    });

    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (error: SocketConnectError) => reject(error));
  });

const expectConnectionError = async (
  token: string | undefined,
  expectedCode: string,
  query?: Record<string, string>
): Promise<void> => {
  await assert.rejects(
    connectClient(token, query),
    (error: SocketConnectError) => {
      assert.equal(error.data?.code, expectedCode);
      return true;
    }
  );
};

const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 1000
): Promise<void> => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Timed out waiting for socket state");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const waitForOnlineUsers = (
  socket: ClientSocket,
  predicate: (userIds: string[]) => boolean
): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("getOnlineUsers", onOnlineUsers);
      reject(new Error("Timed out waiting for getOnlineUsers"));
    }, 1000);

    const onOnlineUsers = (userIds: string[]) => {
      if (!predicate(userIds)) return;
      clearTimeout(timeout);
      socket.off("getOnlineUsers", onOnlineUsers);
      resolve(userIds);
    };

    socket.on("getOnlineUsers", onOnlineUsers);
  });

before(async () => {
  await initializeRedisAdapter();
  await mongoose.connect(config.mongodbUri);

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const createdUsers = await User.create([
    {
      fullname: "Socket Test A",
      email: `${TEST_EMAIL_PREFIX}a-${suffix}@example.com`,
      password: "test-password",
    },
    {
      fullname: "Socket Test B",
      email: `${TEST_EMAIL_PREFIX}b-${suffix}@example.com`,
      password: "test-password",
    },
  ]);

  userA = { _id: createdUsers[0]._id };
  userB = { _id: createdUsers[1]._id };

  const createdSessions = await Session.create([
    {
      userId: userA._id,
      tokenHash: `socket-session-a-${suffix}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      lastUsedAt: new Date(),
    },
    {
      userId: userB._id,
      tokenHash: `socket-session-b-${suffix}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      lastUsedAt: new Date(),
    },
  ]);

  sessionA = createdSessions[0]._id;
  sessionB = createdSessions[1]._id;

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await waitFor(() => io.sockets.sockets.size === 0);
});

after(async () => {
  await waitFor(() => io.sockets.sockets.size === 0);
  await closeSocketInfrastructure();
  await Session.deleteMany({ _id: { $in: [sessionA, sessionB] } });
  await User.deleteMany({ email: { $regex: `^${TEST_EMAIL_PREFIX}` } });
  await mongoose.disconnect();
});

test("rejects socket connections without an access token", async () => {
  await expectConnectionError(undefined, "AUTH_REQUIRED");
});

test("rejects invalid and expired access tokens with distinct auth errors", async () => {
  await expectConnectionError("not-a-jwt", "AUTH_INVALID");

  const expiredToken = issueToken(userA._id, sessionA, -1);
  await expectConnectionError(expiredToken, "AUTH_EXPIRED");
});

test("authenticates from the access cookie and ignores client identity query parameters", async () => {
  const socket = await connectClient(issueToken(userA._id, sessionA), {
    userId: userB._id.toString(),
  });

  try {
    const serverSocket = io.sockets.sockets.get(socket.id);
    assert.ok(serverSocket);
    assert.equal(serverSocket.data.userId, userA._id.toString());

    const room = io.sockets.adapter.rooms.get(getUserRoomName(userA._id.toString()));
    const impersonatedRoom = io.sockets.adapter.rooms.get(
      getUserRoomName(userB._id.toString())
    );

    assert.ok(room?.has(socket.id));
    assert.equal(impersonatedRoom?.has(socket.id) ?? false, false);
    assert.equal(socket.io.opts.query?.userId, userB._id.toString());
  } finally {
    socket.close();
  }
});

test("keeps a user online until the final socket disconnects", async () => {
  const socketA1 = await connectClient(issueToken(userA._id, sessionA));
  const socketA2 = await connectClient(issueToken(userA._id, sessionA));
  const observer = await connectClient(issueToken(userB._id, sessionB));
  let sawPrematureOffline = false;

  const onOnlineUsers = (userIds: string[]) => {
    if (!userIds.includes(userA._id.toString())) {
      sawPrematureOffline = true;
    }
  };
  observer.on("getOnlineUsers", onOnlineUsers);

  try {
    assert.equal(
      io.sockets.adapter.rooms.get(getUserRoomName(userA._id.toString()))?.size,
      2
    );

    socketA1.disconnect();
    await waitFor(
      () =>
        (io.sockets.adapter.rooms.get(getUserRoomName(userA._id.toString()))?.size ?? 0) ===
        1
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(sawPrematureOffline, false);

    const finalOffline = waitForOnlineUsers(
      observer,
      (userIds) => !userIds.includes(userA._id.toString())
    );
    socketA2.disconnect();
    await waitFor(
      () => io.sockets.sockets.size === 1
    );
    await finalOffline;

    await waitFor(
      () =>
        (io.sockets.adapter.rooms.get(getUserRoomName(userA._id.toString()))?.size ?? 0) ===
        0
    );
  } finally {
    observer.off("getOnlineUsers", onOnlineUsers);
    socketA1.close();
    socketA2.close();
    observer.close();
  }
});

test("re-authenticates a new socket on reconnect instead of reusing client identity", async () => {
  const socket = await connectClient(issueToken(userA._id, sessionA));

  try {
    const firstSocketId = socket.id;
    assert.ok(firstSocketId);
    assert.ok(
      io.sockets.adapter.rooms
        .get(getUserRoomName(userA._id.toString()))
        ?.has(firstSocketId)
    );

    socket.io.opts.extraHeaders = {
      Cookie: `accessToken=${encodeURIComponent(issueToken(userB._id, sessionB))}`,
    };
    socket.disconnect();
    socket.connect();

    await once(socket, "connect");

    assert.notEqual(socket.id, firstSocketId);
    assert.ok(
      io.sockets.adapter.rooms
        .get(getUserRoomName(userB._id.toString()))
        ?.has(socket.id)
    );
    assert.equal(
      io.sockets.adapter.rooms.get(getUserRoomName(userA._id.toString()))?.has(socket.id) ??
        false,
      false
    );
  } finally {
    socket.close();
  }
});
