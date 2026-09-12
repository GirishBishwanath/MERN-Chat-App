import express, { type Request, type Response } from "express";
import mongoose from "mongoose";

const router = express.Router();

router.get("/live", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

router.get("/ready", (_req: Request, res: Response) => {
  const ready = mongoose.connection.readyState === 1;

  return res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    database: ready ? "connected" : "disconnected",
  });
});

export default router;
