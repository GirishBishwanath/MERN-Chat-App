import { Pool, type PoolConfig } from "pg";

import { config } from "../config/env.js";

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
  // Pool errors can happen on idle connections without an active request.
  // Keep the process alive and let the next query surface availability failures.
  console.error("postgres_pool_error", {
    errorName: error.name,
  });
});

export const verifyPostgresConnection = async (): Promise<void> => {
  const client = await postgresPool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
};

export const closePostgresPool = async (): Promise<void> => {
  await postgresPool.end();
};
