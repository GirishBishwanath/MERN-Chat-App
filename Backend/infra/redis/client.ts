import { createClient } from "redis";

import { config } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import {
  incrementCounter,
  observeHistogram,
} from "../../observability/metrics.js";

export type RedisClient = ReturnType<typeof createClient>;

const redisClient = createClient({ url: config.redis.url });

redisClient.on("error", (error: unknown) => {
  incrementCounter("redis_errors_total", { operation: "client" });
  logger.error("redis_client_error", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
});

redisClient.on("reconnecting", () => {
  logger.warn("redis_client_reconnecting");
});

redisClient.on("ready", () => {
  logger.info("redis_ready");
});

redisClient.on("end", () => {
  logger.warn("redis_client_disconnected");
});

export const connectRedis = async (): Promise<void> => {
  if (redisClient.isOpen) return;
  await redisClient.connect();
  logger.info("redis_connected");
};

export const verifyRedisConnection = async (): Promise<void> => {
  const startedAt = process.hrtime.bigint();

  try {
    await redisClient.ping();
    observeHistogram(
      "redis_operation_duration_seconds",
      Number(process.hrtime.bigint() - startedAt) / 1e9,
      { operation: "ping" }
    );
  } catch (error) {
    incrementCounter("redis_errors_total", { operation: "ping" });
    throw error;
  }
};

export const closeRedis = async (): Promise<void> => {
  if (!redisClient.isOpen) return;

  try {
    await redisClient.quit();
    logger.info("redis_disconnected");
  } catch (error) {
    incrementCounter("redis_errors_total", { operation: "close" });
    throw error;
  }
};

export const getRedisClient = (): RedisClient => redisClient;
export const createRedisSubscriber = (): RedisClient => redisClient.duplicate();
