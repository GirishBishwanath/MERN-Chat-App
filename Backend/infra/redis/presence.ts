import type { RedisClient } from "./client.js";

const PRESENCE_KEY_PREFIX = "chatapp:presence:user:";
const SOCKETS_SUFFIX = ":sockets";
const ONLINE_USERS_KEY = "chatapp:presence:users";

export const PRESENCE_TTL_SECONDS = 60;
const PRESENCE_KEY_TTL_SECONDS = PRESENCE_TTL_SECONDS * 2;

const socketsKey = (userId: string): string =>
  `${PRESENCE_KEY_PREFIX}${userId}${SOCKETS_SUFFIX}`;

const expiryScore = (): number =>
  Date.now() + PRESENCE_TTL_SECONDS * 1000;

const MARK_ONLINE_SCRIPT = `
local sockets_key = KEYS[1]
local online_users_key = KEYS[2]
local user_id = ARGV[1]
local socket_id = ARGV[2]
local expiry = tonumber(ARGV[3])
local key_ttl = tonumber(ARGV[4])

redis.call("ZADD", sockets_key, expiry, socket_id)
redis.call("EXPIRE", sockets_key, key_ttl)

local current = redis.call("ZRANGE", sockets_key, -1, -1, "WITHSCORES")
local max_expiry = tonumber(current[2])
redis.call("ZADD", online_users_key, max_expiry, user_id)

return 1
`;

const MARK_OFFLINE_SCRIPT = `
local sockets_key = KEYS[1]
local online_users_key = KEYS[2]
local user_id = ARGV[1]
local socket_id = ARGV[2]

redis.call("ZREM", sockets_key, socket_id)

local current = redis.call("ZRANGE", sockets_key, -1, -1, "WITHSCORES")
if #current == 0 then
  redis.call("ZREM", online_users_key, user_id)
  redis.call("DEL", sockets_key)
  return 0
end

local max_expiry = tonumber(current[2])
redis.call("ZADD", online_users_key, max_expiry, user_id)
return 1
`;

const IS_ONLINE_SCRIPT = `
local sockets_key = KEYS[1]
local online_users_key = KEYS[2]
local user_id = ARGV[1]
local now = tonumber(ARGV[2])

redis.call("ZREMRANGEBYSCORE", sockets_key, 0, now)

local current = redis.call("ZRANGE", sockets_key, -1, -1, "WITHSCORES")
if #current == 0 then
  redis.call("ZREM", online_users_key, user_id)
  redis.call("DEL", sockets_key)
  return 0
end

local max_expiry = tonumber(current[2])
redis.call("ZADD", online_users_key, max_expiry, user_id)
return 1
`;

const GET_ONLINE_USERS_SCRIPT = `
local online_users_key = KEYS[1]
local now = tonumber(ARGV[1])

redis.call("ZREMRANGEBYSCORE", online_users_key, 0, now)
return redis.call("ZRANGE", online_users_key, 0, -1)
`;

export const markUserOnline = async (
  client: RedisClient,
  userId: string,
  socketId = "legacy"
): Promise<void> => {
  await client.eval(MARK_ONLINE_SCRIPT, {
    keys: [socketsKey(userId), ONLINE_USERS_KEY],
    arguments: [
      userId,
      socketId,
      String(expiryScore()),
      String(PRESENCE_KEY_TTL_SECONDS),
    ],
  });
};

export const markUserOffline = async (
  client: RedisClient,
  userId: string,
  socketId = "legacy"
): Promise<void> => {
  await client.eval(MARK_OFFLINE_SCRIPT, {
    keys: [socketsKey(userId), ONLINE_USERS_KEY],
    arguments: [userId, socketId],
  });
};

export const isUserOnline = async (
  client: RedisClient,
  userId: string
): Promise<boolean> => {
  const result = await client.eval(IS_ONLINE_SCRIPT, {
    keys: [socketsKey(userId), ONLINE_USERS_KEY],
    arguments: [userId, String(Date.now())],
  });

  return result === 1;
};

export const getOnlineUserIds = async (
  client: RedisClient
): Promise<string[]> => {
  const result = await client.eval(GET_ONLINE_USERS_SCRIPT, {
    keys: [ONLINE_USERS_KEY],
    arguments: [String(Date.now())],
  });

  if (!Array.isArray(result)) {
    throw new Error("Redis presence index returned an invalid result");
  }

  return result.map((userId) => String(userId));
};
