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

const waitFor = async (
  predicate: () => Promise<boolean>,
  timeoutMs = 2500
): Promise<void> => {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Timed out waiting for Redis state");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

test.before(async () => {
  await redis.connect();
});

test.after(async () => {
  await redis.quit();
});

test.beforeEach(async () => {
  await redis.flushDb();
});

test("marks a user online with a bounded TTL", async () => {
  const userId = "redis-test-online";

  await markUserOnline(redis, userId);

  assert.equal(await isUserOnline(redis, userId), true);
  const ttl = await redis.ttl(`chatapp:presence:user:${userId}`);
  assert.ok(ttl > 0);
  assert.ok(ttl <= PRESENCE_TTL_SECONDS);
});

test("refreshes the presence lease for an already-connected socket", async () => {
  const userId = "redis-test-refresh";
  const socketId = "redis-test-refresh-socket";

  await redis.set(`chatapp:presence:user:${userId}:sockets`, "stale", { EX: 1 });
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

test("returns only active users from a candidate set", async () => {
  await markUserOnline(redis, "user-a", "socket-a");
  await markUserOnline(redis, "user-c", "socket-c");

  assert.deepEqual(await getOnlineUserIds(redis, ["user-a", "user-b", "user-c"]), [
    "user-a",
    "user-c",
  ]);
});

test("expired presence is treated as offline", async () => {
  const userId = "redis-test-expiry";
  const socketId = "redis-test-expiry-socket";

  await redis.zAdd(`chatapp:presence:user:${userId}:sockets`, [
    { score: Date.now() + 1000, value: socketId },
  ]);
  await redis.zAdd(`chatapp:presence:user:${userId}:sockets`, [
    { score: Date.now() - 1, value: "expired-socket" },
  ]);

  assert.equal(await isUserOnline(redis, userId), true);
  await redis.del(`chatapp:presence:user:${userId}:sockets`);
  assert.equal(await isUserOnline(redis, userId), false);
});
