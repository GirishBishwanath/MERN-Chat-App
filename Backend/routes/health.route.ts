import express, { type Request, type Response } from "express";
import { verifyPostgresConnection } from "../db/pool.js";
import { verifyRedisConnection } from "../infra/redis/client.js";

const router = express.Router();

router.get("/live", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

router.get("/ready", async (_req: Request, res: Response) => {
  try {
    await verifyPostgresConnection();
    await verifyRedisConnection();
    return res.status(200).json({
      status: "ready",
      database: "connected",
      redis: "connected",
    });
  } catch {
    return res.status(503).json({
      status: "not_ready",
      dependencies: "unavailable",
    });
  }
});

export default router;
