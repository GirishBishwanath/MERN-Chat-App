import { createClient, type RedisClientType } from "redis";

import { config } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

export type RedisClient = RedisClientType;

const redisClient = createClient({ url: config.redis.url });

redisClient.on("error", (error: unknown) => {
  logger.error("redis_client_error", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
});

redisClient.on("reconnecting", () => {
  logger.info("redis_client_reconnecting");
});

export const connectRedis = async (): Promise<void> => {
  if (redisClient.isOpen) return;
  await redisClient.connect();
  logger.info("redis_connected");
};

export const verifyRedisConnection = async (): Promise<void> => {
  await redisClient.ping();
};

export const closeRedis = async (): Promise<void> => {
  if (!redisClient.isOpen) return;
  await redisClient.quit();
  logger.info("redis_disconnected");
};

export const getRedisClient = (): RedisClient => redisClient;

export const createRedisSubscriber = (): RedisClient => redisClient.duplicate();
