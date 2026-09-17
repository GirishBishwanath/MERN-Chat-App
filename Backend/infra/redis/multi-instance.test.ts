import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";

import { Server } from "socket.io";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";

import { getUserRoomName } from "../../SocketIO/server.js";
import { getRedisClient } from "./client.js";

const createTestInstance = () => {
  const server = http.createServer();
  const io = new Server(server, { transports: ["websocket"] });
  return { server, io };
};

const connect = (url: string): Promise<ClientSocket> =>
  new Promise((resolve, reject) => {
    const socket = createClient(url, {
      transports: ["websocket"],
      reconnection: false,
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });

test("Redis is available for multi-instance adapter integration", async (t) => {
  const redis = getRedisClient();
  if (!redis.isReady) {
    t.skip("Redis is not running; cross-instance integration requires a real Redis instance");
    return;
  }

  assert.equal(redis.isReady, true);

  const instanceA = createTestInstance();
  const instanceB = createTestInstance();
  const sockets: ClientSocket[] = [];

  try {
    await Promise.all([
      new Promise<void>((resolve) => instanceA.server.listen(0, "127.0.0.1", () => resolve())),
      new Promise<void>((resolve) => instanceB.server.listen(0, "127.0.0.1", () => resolve())),
    ]);

    const addressA = instanceA.server.address();
    const addressB = instanceB.server.address();
    assert.ok(addressA && typeof addressA !== "string");
    assert.ok(addressB && typeof addressB !== "string");

    const redisSubscriberA = redis.duplicate();
    const redisSubscriberB = redis.duplicate();
    await Promise.all([redisSubscriberA.connect(), redisSubscriberB.connect()]);

    const { createAdapter } = await import("@socket.io/redis-adapter");
    instanceA.io.adapter((await import("@socket.io/redis-adapter")).createAdapter(redis, redisSubscriberA));
    const pubB = redis.duplicate();
    await pubB.connect();
    instanceB.io.adapter(createAdapter(pubB, redisSubscriberB));

    instanceA.io.on("connection", (socket) => {
      void socket.join(getUserRoomName("cross-instance-user"));
    });

    const client = await connect(`http://127.0.0.1:${addressA.port}`);
    sockets.push(client);

    await once(client, "connect");
    const received = new Promise<string>((resolve) =>
      client.once("cross-instance-test", resolve)
    );

    instanceB.io.to(getUserRoomName("cross-instance-user")).emit(
      "cross-instance-test",
      "delivered"
    );

    assert.equal(await received, "delivered");

    await Promise.all([
      redisSubscriberA.quit(),
      redisSubscriberB.quit(),
      pubB.quit(),
    ]);
  } finally {
    for (const socket of sockets) socket.close();
    await Promise.all([
      new Promise<void>((resolve) => instanceA.server.close(() => resolve())),
      new Promise<void>((resolve) => instanceB.server.close(() => resolve())),
    ]);
  }
});
