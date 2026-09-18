import type { RedisClient } from "./client.js";

const PRESENCE_KEY_PREFIX = "chatapp:presence:user:";
const SOCKETS_SUFFIX = ":sockets";
export const PRESENCE_TTL_SECONDS = 60;

const socketsKey = (userId: string): string =>
  `${PRESENCE_KEY_PREFIX}${userId}${SOCKETS_SUFFIX}`;

const expiryScore = (): number =>
  Date.now() + PRESENCE_TTL_SECONDS * 1000;

export const markUserOnline = async (
  client: RedisClient,
  userId: string,
  socketId = "legacy"
): Promise<void> => {
  await client.zAdd(socketsKey(userId), [{ score: expiryScore(), value: socketId }]);
};

export const markUserOffline = async (
  client: RedisClient,
  userId: string,
  socketId = "legacy"
): Promise<void> => {
  await client.zRem(socketsKey(userId), socketId);
  if ((await client.zCard(socketsKey(userId))) === 0) {
    await client.del(socketsKey(userId));
  }
};

const pruneExpiredSockets = async (
  client: RedisClient,
  userId: string
): Promise<boolean> => {
  const key = socketsKey(userId);
  await client.zRemRangeByScore(key, 0, Date.now());
  const activeCount = await client.zCard(key);

  if (activeCount === 0) {
    await client.del(key);
    return false;
  }

  return true;
};

export const isUserOnline = async (
  client: RedisClient,
  userId: string
): Promise<boolean> => pruneExpiredSockets(client, userId);

export const getOnlineUserIds = async (
  client: RedisClient,
  candidateUserIds: string[]
): Promise<string[]> => {
  const onlineUserIds: string[] = [];

  for (const userId of candidateUserIds) {
    if (await isUserOnline(client, userId)) {
      onlineUserIds.push(userId);
    }
  }

  return onlineUserIds;
};
