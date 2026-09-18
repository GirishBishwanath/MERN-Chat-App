import assert from "node:assert/strict";
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

test("Redis adapter delivers room events across two Socket.IO instances", async () => {
  const redis = getRedisClient();
  if (!redis.isOpen) await redis.connect();

  const instanceA = createTestInstance();
  const instanceB = createTestInstance();
  const sockets: ClientSocket[] = [];
  const redisSubscriberA = redis.duplicate();
  const redisSubscriberB = redis.duplicate();
  const redisPublisherB = redis.duplicate();

  try {
    await Promise.all([
      new Promise<void>((resolve) => instanceA.server.listen(0, "127.0.0.1", () => resolve())),
      new Promise<void>((resolve) => instanceB.server.listen(0, "127.0.0.1", () => resolve())),
      redisSubscriberA.connect(),
      redisSubscriberB.connect(),
      redisPublisherB.connect(),
    ]);

    const addressA = instanceA.server.address();
    assert.ok(addressA && typeof addressA !== "string");

    const { createAdapter } = await import("@socket.io/redis-adapter");
    instanceA.io.adapter(createAdapter(redis, redisSubscriberA));
    instanceB.io.adapter(createAdapter(redisPublisherB, redisSubscriberB));

    instanceA.io.on("connection", (socket) => {
      void socket.join(getUserRoomName("cross-instance-user"));
    });

    const client = await connect(`http://127.0.0.1:${addressA.port}`);
    sockets.push(client);

    const received = new Promise<string>((resolve) =>
      client.once("cross-instance-test", resolve)
    );

    instanceB.io.to(getUserRoomName("cross-instance-user")).emit(
      "cross-instance-test",
      "delivered"
    );

    assert.equal(await received, "delivered");
  } finally {
    for (const socket of sockets) socket.close();

    await Promise.all([
      redisSubscriberA.isOpen ? redisSubscriberA.quit() : Promise.resolve(),
      redisSubscriberB.isOpen ? redisSubscriberB.quit() : Promise.resolve(),
      redisPublisherB.isOpen ? redisPublisherB.quit() : Promise.resolve(),
      new Promise<void>((resolve) => instanceA.server.close(() => resolve())),
      new Promise<void>((resolve) => instanceB.server.close(() => resolve())),
    ]);
  }
});
