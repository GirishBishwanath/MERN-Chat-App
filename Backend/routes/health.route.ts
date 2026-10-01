import express, { type Request, type Response } from "express";

import { verifyPostgresConnection } from "../db/pool.js";
import { getKafkaHealthSnapshot } from "../infra/kafka/client.js";
import { verifyRedisConnection } from "../infra/redis/client.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

router.get("/live", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

router.get("/ready", async (_req: Request, res: Response) => {
  let database = "unavailable";
  let redis = "unavailable";

  try {
    await verifyPostgresConnection();
    database = "connected";
  } catch {
    database = "unavailable";
  }

  try {
    await verifyRedisConnection();
    redis = "connected";
  } catch {
    redis = "unavailable";
  }

  const kafka = getKafkaHealthSnapshot();
  logger.debug("health_readiness_dependencies", {
    database,
    redis,
    kafka: kafka.enabled ? (kafka.connected ? "connected" : "unavailable") : "disabled",
  });

  if (database !== "connected" || redis !== "connected") {
    return res.status(503).json({
      status: "not_ready",
      database,
      redis,
    });
  }

  return res.status(200).json({
    status: "ready",
    database,
    redis,
  });
});

export default router;
