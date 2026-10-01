import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  incrementCounter,
  metricsContentType,
  observeHistogram,
  renderMetrics,
  renderOutboxGauges,
  resetMetrics,
  setOutboxGaugeSnapshot,
} from "./metrics.js";

beforeEach(() => resetMetrics());

test("renders counters and cumulative histogram buckets", () => {
  incrementCounter("http_requests_total", {
    method: "GET",
    route: "/health/live",
    status: "200",
  }, 2);

  observeHistogram("http_request_duration_seconds", 0.02, {
    method: "GET",
    route: "/health/live",
    status: "200",
  });

  const output = renderMetrics();

  assert.match(
    output,
    /http_requests_total{method="GET",route="\/health\/live",status="200"} 2/
  );
  assert.match(
    output,
    /http_request_duration_seconds_bucket{le="0.025",method="GET",route="\/health\/live",status="200"} 1/
  );
  assert.match(
    output,
    /http_request_duration_seconds_bucket{le="0.05",method="GET",route="\/health\/live",status="200"} 1/
  );
  assert.equal(metricsContentType, "text/plain; version=0.0.4; charset=utf-8");
});

test("outbox gauges do not expose high-cardinality identifiers", () => {
  setOutboxGaugeSnapshot(4, 2, 12.5);
  const output = renderOutboxGauges();

  assert.match(output, /outbox_pending_events 4/);
  assert.match(output, /outbox_processing_events 2/);
  assert.match(output, /outbox_oldest_pending_age_seconds 12.5/);
  assert.doesNotMatch(output, /eventId|userId|messageId|conversationId/);
});
