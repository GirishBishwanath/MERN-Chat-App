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

test("refreshes the presence TTL for an already-online user", async () => {
  const userId = "redis-test-refresh";

  await redis.set(`chatapp:presence:user:${userId}`, "1", { EX: 1 });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await markUserOnline(redis, userId);

  assert.ok((await redis.ttl(`chatapp:presence:user:${userId}`)) > 1);
});

test("removes a user's presence explicitly", async () => {
  const userId = "redis-test-offline";

  await markUserOnline(redis, userId);
  await markUserOffline(redis, userId);

  assert.equal(await isUserOnline(redis, userId), false);
});

test("returns only active users from a candidate set", async () => {
  await markUserOnline(redis, "user-a");
  await markUserOnline(redis, "user-c");

  assert.deepEqual(await getOnlineUserIds(redis, ["user-a", "user-b", "user-c"]), [
    "user-a",
    "user-c",
  ]);
});

test("expired presence is treated as offline", async () => {
  const userId = "redis-test-expiry";
  await redis.set(`chatapp:presence:user:${userId}`, "1", { EX: 1 });

  await waitFor(async () => !(await isUserOnline(redis, userId)));

  assert.equal(await isUserOnline(redis, userId), false);
});
