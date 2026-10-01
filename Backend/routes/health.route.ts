import express, { type Request, type Response } from "express";

import { verifyPostgresConnection } from "../db/pool.js";
import { getKafkaHealthSnapshot } from "../infra/kafka/client.js";
import { verifyRedisConnection } from "../infra/redis/client.js";

type DependencyStatus = "connected" | "unavailable" | "disabled";

const router = express.Router();

router.get("/live", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

router.get("/ready", async (_req: Request, res: Response) => {
  const dependencies: Record<string, DependencyStatus> = {};

  try {
    await verifyPostgresConnection();
    dependencies.database = "connected";
  } catch {
    dependencies.database = "unavailable";
  }

  try {
    await verifyRedisConnection();
    dependencies.redis = "connected";
  } catch {
    dependencies.redis = "unavailable";
  }

  const kafka = getKafkaHealthSnapshot();
  dependencies.kafka = kafka.enabled
    ? (kafka.connected ? "connected" : "unavailable")
    : "disabled";

  if (dependencies.database !== "connected" || dependencies.redis !== "connected") {
    return res.status(503).json({
      status: "not_ready",
      dependencies,
    });
  }

  return res.status(200).json({
    status: "ready",
    dependencies,
  });
});

export default router;
