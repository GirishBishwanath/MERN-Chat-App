import { Pool, type PoolConfig } from "pg";

import { config } from "../config/env.js";
import { incrementCounter, observeHistogram } from "../observability/metrics.js";
import { logger } from "../utils/logger.js";

const poolConfig: PoolConfig = {
  host: config.postgres.host,
  port: config.postgres.port,
  database: config.postgres.database,
  user: config.postgres.user,
  password: config.postgres.password,
  max: config.postgres.maxConnections,
  idleTimeoutMillis: config.postgres.idleTimeoutMs,
  connectionTimeoutMillis: config.postgres.connectionTimeoutMs,
  ssl: config.postgres.ssl,
  application_name: "mern-chat-app-api",
};

export const postgresPool = new Pool(poolConfig);

postgresPool.on("error", (error) => {
  incrementCounter("db_operation_errors_total", { operation: "pool" });
  logger.error("postgres_pool_error", {
    errorName: error.name,
  });
});

export const verifyPostgresConnection = async (): Promise<void> => {
  const startedAt = process.hrtime.bigint();

  try {
    const client = await postgresPool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }

    observeHistogram(
      "db_operation_duration_seconds",
      Number(process.hrtime.bigint() - startedAt) / 1e9,
      { operation: "healthcheck" }
    );
  } catch (error) {
    incrementCounter("db_operation_errors_total", { operation: "healthcheck" });
    throw error;
  }
};

export const closePostgresPool = async (): Promise<void> => {
  await postgresPool.end();
};
