import { config } from "./config/env.js";
import { closePostgresPool, verifyPostgresConnection } from "./db/pool.js";
import { app } from "./app.js";
import { closeSocketInfrastructure, initializeRedisAdapter, server } from "./SocketIO/server.js";
import { logger } from "./utils/logger.js";

const startServer = async (): Promise<void> => {
  await verifyPostgresConnection();
  logger.info("database_connected", { database: "postgresql" });
  await initializeRedisAdapter();
  logger.info("redis_adapter_initialized");
  server.listen(config.port, "0.0.0.0", () =>
    logger.info("server_started", { port: config.port })
  );
};

const shutdown = async (signal: string): Promise<void> => {
  logger.info("server_shutdown_started", { signal });
  try {
    await closeSocketInfrastructure();
    await closePostgresPool();
    logger.info("server_shutdown_completed");
    process.exit(0);
  } catch (error: unknown) {
    logger.error("server_shutdown_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    process.exit(1);
  }
};

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

void startServer().catch((error: unknown) => {
  logger.error("server_start_failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  process.exit(1);
});

export { app };
