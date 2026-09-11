import express from "express";
import mongoose from "mongoose";

const router = express.Router();

router.get("/live", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

router.get("/ready", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  return res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    database: ready ? "connected" : "disconnected",
  });
});

export default router;
