import type { RedisClient } from "./client.js";

const PRESENCE_KEY_PREFIX = "chatapp:presence:user:";
export const PRESENCE_TTL_SECONDS = 60;

const presenceKey = (userId: string): string =>
  `${PRESENCE_KEY_PREFIX}${userId}`;

export const markUserOnline = async (
  client: RedisClient,
  userId: string
): Promise<void> => {
  await client.set(presenceKey(userId), "1", { EX: PRESENCE_TTL_SECONDS });
};

export const markUserOffline = async (
  client: RedisClient,
  userId: string
): Promise<void> => {
  await client.del(presenceKey(userId));
};

export const isUserOnline = async (
  client: RedisClient,
  userId: string
): Promise<boolean> => (await client.exists(presenceKey(userId))) === 1;

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
