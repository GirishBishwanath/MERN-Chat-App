import express, { type Request, type Response } from "express";

import {
  incrementCounter,
  metricsContentType,
  renderMetrics,
  renderOutboxGauges,
  setOutboxGaugeSnapshot,
} from "../observability/metrics.js";
import { getOutboxOperationalSnapshot } from "../repositories/postgres/outbox.repository.js";

const router = express.Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const snapshot = await getOutboxOperationalSnapshot();
    setOutboxGaugeSnapshot(
      snapshot.pending,
      snapshot.processing,
      snapshot.oldestPendingAgeSeconds
    );
  } catch {
    incrementCounter("outbox_metrics_collection_failures_total");
  }

  res.set("Content-Type", metricsContentType);
  return res.status(200).send(renderMetrics() + renderOutboxGauges());
});

export default router;
