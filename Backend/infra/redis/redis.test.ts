import assert from "node:assert/strict";
import test from "node:test";

import { createClient } from "redis";

import { config } from "../../config/env.js";
import {
  getOnlineUserIds,
  isUserOnline,
  markUserOffline,
  markUserOnline,
  PRESENCE_TTL_SECONDS,
} from "./presence.js";

const redis = createClient({ url: config.redis.url });


test.before(async () => {
  await redis.connect();
});

test.after(async () => {
  await redis.quit();
});

test.beforeEach(async () => {
  await redis.flushDb();
});

test("marks a user online with a bounded lease", async () => {
  const userId = "redis-test-online";
  const socketId = "redis-test-socket";

  await markUserOnline(redis, userId, socketId);

  assert.equal(await isUserOnline(redis, userId), true);
  const expiry = await redis.zScore(
    `chatapp:presence:user:${userId}:sockets`,
    socketId
  );
  assert.ok(expiry);
  assert.ok(expiry > Date.now());
  assert.ok(expiry - Date.now() <= PRESENCE_TTL_SECONDS * 1000);
});

test("refreshes the presence lease for an already-connected socket", async () => {
  const userId = "redis-test-refresh";
  const socketId = "redis-test-refresh-socket";

  await markUserOnline(redis, userId, socketId);

  const firstExpiry = await redis.zScore(
    `chatapp:presence:user:${userId}:sockets`,
    socketId
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await markUserOnline(redis, userId, socketId);

  const refreshedExpiry = await redis.zScore(
    `chatapp:presence:user:${userId}:sockets`,
    socketId
  );

  assert.ok(firstExpiry);
  assert.ok(refreshedExpiry);
  assert.ok(refreshedExpiry > firstExpiry);
  assert.ok(
    refreshedExpiry - Date.now() <= PRESENCE_TTL_SECONDS * 1000
  );
});

test("removes a socket lease without affecting another socket", async () => {
  const userId = "redis-test-offline";
  await markUserOnline(redis, userId, "socket-a");
  await markUserOnline(redis, userId, "socket-b");

  await markUserOffline(redis, userId, "socket-a");

  assert.equal(await isUserOnline(redis, userId), true);
  await markUserOffline(redis, userId, "socket-b");
  assert.equal(await isUserOnline(redis, userId), false);
});

test("returns active users across the distributed presence index", async () => {
  await markUserOnline(redis, "user-a", "socket-a");
  await markUserOnline(redis, "user-c", "socket-c");

  assert.deepEqual(await getOnlineUserIds(redis), ["user-a", "user-c"]);
});

test("removes a user from the global index when its final lease expires", async () => {
  const userId = "redis-test-global-expiry";
  const socketId = "redis-test-global-expiry-socket";

  await redis.zAdd(`chatapp:presence:user:${userId}:sockets`, [
    { score: Date.now() - 1, value: socketId },
  ]);
  await redis.zAdd("chatapp:presence:users", [
    { score: Date.now() - 1, value: userId },
  ]);

  assert.equal(await isUserOnline(redis, userId), false);
  assert.deepEqual(await getOnlineUserIds(redis), []);
});

test("keeps another socket online during a concurrent-style final disconnect transition", async () => {
  const userId = "redis-test-race";
  await markUserOnline(redis, userId, "socket-a");
  await markUserOnline(redis, userId, "socket-b");

  await markUserOffline(redis, userId, "socket-a");

  assert.deepEqual(await getOnlineUserIds(redis), [userId]);
  assert.equal(await isUserOnline(redis, userId), true);
});


test("emits the global online-user index after the final socket disconnects", async () => {
  const userId = "redis-test-final-disconnect";
  await markUserOnline(redis, userId, "socket-a");
  await markUserOnline(redis, userId, "socket-b");

  await markUserOffline(redis, userId, "socket-a");
  assert.deepEqual(await getOnlineUserIds(redis), [userId]);

  await markUserOffline(redis, userId, "socket-b");
  assert.deepEqual(await getOnlineUserIds(redis), []);
});

test("expired presence is treated as offline", async () => {
  const userId = "redis-test-expiry";
  const socketId = "redis-test-expiry-socket";

  await redis.zAdd(`chatapp:presence:user:${userId}:sockets`, [
    { score: Date.now() - 1, value: socketId },
  ]);

  assert.equal(await isUserOnline(redis, userId), false);
});
