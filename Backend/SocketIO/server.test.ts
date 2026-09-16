import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";

import { config } from "../config/env.js";
import { closePostgresPool } from "../db/pool.js";
import { sendMessage as sendMessageController } from "../controller/message.controller.js";
import User from "../models/user.model.js";
import { getUserRoomName, io, server } from "./server.js";

interface SocketConnectError extends Error {
  data?: {
    code?: string;
  };
}

interface TestUser {
  _id: mongoose.Types.ObjectId;
  fullname: string;
  email: string;
}

const TEST_EMAIL_PREFIX = "socket-test-";

let userA: TestUser;
let userB: TestUser;
let baseUrl: string;

const issueToken = (
  userId: mongoose.Types.ObjectId,
  expiresIn: jwt.SignOptions["expiresIn"] = "15m"
): string =>
  jwt.sign({ userId: userId.toString() }, config.jwtSecret, { expiresIn });

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

const waitForEvent = <T>(
  socket: ClientSocket,
  event: string
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 1000);

    const handler = (payload: T) => {
      clearTimeout(timeout);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });

const closeClient = async (socket: ClientSocket): Promise<void> => {
  if (!socket.connected) {
    socket.close();
    return;
  }

  await new Promise<void>((resolve) => {
    socket.once("disconnect", () => resolve());
    socket.close();
  });
};

before(async () => {
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

  userA = {
    _id: createdUsers[0]._id,
    fullname: createdUsers[0].fullname,
    email: createdUsers[0].email,
  };
  userB = {
    _id: createdUsers[1]._id,
    fullname: createdUsers[1].fullname,
    email: createdUsers[1].email,
  };

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  for (const socket of io.sockets.sockets.values()) {
    socket.disconnect(true);
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await User.deleteMany({ email: { $regex: `^${TEST_EMAIL_PREFIX}` } });
  await closePostgresPool();
  await mongoose.disconnect();
});

test("rejects socket connections without an access token", async () => {
  await expectConnectionError(undefined, "AUTH_REQUIRED");
});

test("rejects invalid and expired access tokens with distinct auth errors", async () => {
  await expectConnectionError("not-a-jwt", "AUTH_INVALID");

  const expiredToken = issueToken(userA._id, -1);
  await expectConnectionError(expiredToken, "AUTH_EXPIRED");
});

test("authenticates from the access cookie and ignores client identity query parameters", async () => {
  const socket = await connectClient(issueToken(userA._id), {
    userId: userB._id.toString(),
  });

  try {
    const room = io.sockets.adapter.rooms.get(getUserRoomName(userA._id.toString()));
    const impersonatedRoom = io.sockets.adapter.rooms.get(
      getUserRoomName(userB._id.toString())
    );

    assert.ok(room?.has(socket.id));
    assert.equal(impersonatedRoom?.has(socket.id) ?? false, false);
    assert.equal(socket.handshake.query.userId, userB._id.toString());
  } finally {
    await closeClient(socket);
  }
});

test("keeps a user online until the final socket disconnects", async () => {
  const socketA1 = await connectClient(issueToken(userA._id));
  const socketA2 = await connectClient(issueToken(userA._id));
  const observer = await connectClient(issueToken(userB._id));

  try {
    assert.equal(
      io.sockets.adapter.rooms.get(getUserRoomName(userA._id.toString()))?.size,
      2
    );

    await closeClient(socketA1);

    assert.equal(
      io.sockets.adapter.rooms.get(getUserRoomName(userA._id.toString()))?.size,
      1
    );

    let sawPrematureOffline = false;
    const onOnlineUsers = (userIds: string[]) => {
      if (!userIds.includes(userA._id.toString())) {
        sawPrematureOffline = true;
      }
    };
    observer.on("getOnlineUsers", onOnlineUsers);

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(sawPrematureOffline, false);
    observer.off("getOnlineUsers", onOnlineUsers);

    const finalOffline = waitForOnlineUsers(
      observer,
      (userIds) => !userIds.includes(userA._id.toString())
    );
    await closeClient(socketA2);
    await finalOffline;

    assert.equal(
      io.sockets.adapter.rooms.get(getUserRoomName(userA._id.toString()))?.size ?? 0,
      0
    );
  } finally {
    await closeClient(socketA1);
    await closeClient(socketA2);
    await closeClient(observer);
  }
});

test("re-authenticates a new socket on reconnect instead of reusing client identity", async () => {
  const socket = await connectClient(issueToken(userA._id));

  try {
    const firstSocketId = socket.id;
    assert.ok(firstSocketId);
    assert.ok(
      io.sockets.adapter.rooms
        .get(getUserRoomName(userA._id.toString()))
        ?.has(firstSocketId)
    );

    const reconnected = new Promise<void>((resolve) => {
      socket.once("connect", () => resolve());
    });

    socket.io.opts.extraHeaders = {
      Cookie: `accessToken=${encodeURIComponent(issueToken(userB._id))}`,
    };
    socket.disconnect();
    socket.connect();
    await reconnected;

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
    await closeClient(socket);
  }
});

test("emits a persisted message to the receiver's server-managed user room", async () => {
  const receiverSocket = await connectClient(issueToken(userB._id));
  const receivedMessage = waitForEvent<{
    _id: string;
    senderId: string;
    receiverId: string;
    message: string;
    createdAt: string;
    updatedAt: string;
  }>(receiverSocket, "newMessage");

  const responseBody: { data?: { _id: string; message: string } } = {};
  const response = {
    statusCode: 0,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload: { data?: { _id: string; message: string } }) {
      Object.assign(responseBody, payload);
      return this;
    },
  } as never;

  const request = {
    params: { id: userB._id.toString() },
    body: { message: "socket integration test" },
    user: userA,
  } as never;

  try {
    await sendMessageController(request, response);
    const message = await receivedMessage;

    assert.equal(response.statusCode, 201);
    assert.equal(responseBody.data?.message, "socket integration test");
    assert.equal(message._id, responseBody.data?._id);
    assert.equal(message.senderId, userA._id.toString());
    assert.equal(message.receiverId, userB._id.toString());
    assert.equal(message.message, "socket integration test");
  } finally {
    await closeClient(receiverSocket);
  }
});
