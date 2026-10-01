type MetricLabels = Record<string, string>;

type CounterSeries = Map<string, { labels: MetricLabels; value: number }>;
type HistogramSeries = Map<string, {
  labels: MetricLabels;
  count: number;
  sum: number;
  buckets: number[];
}>;

const counters = new Map<string, CounterSeries>();
const counterHelp = new Map<string, string>();
const histograms = new Map<string, HistogramSeries>();
const histogramHelp = new Map<string, { help: string; buckets: number[] }>();

const labelKey = (labels: MetricLabels): string =>
  JSON.stringify(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));

const renderLabels = (labels: MetricLabels): string => {
  const pairs = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) =>
      `${key}="${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
    );

  return pairs.length > 0 ? `{${pairs.join(",")}}` : "";
};

export const defineCounter = (name: string, help: string): void => {
  if (counterHelp.has(name)) return;
  counterHelp.set(name, help);
  counters.set(name, new Map());
};

export const defineHistogram = (
  name: string,
  help: string,
  buckets: number[]
): void => {
  if (histogramHelp.has(name)) return;

  const normalizedBuckets = [...new Set(
    buckets.filter((bucket) => Number.isFinite(bucket) && bucket > 0)
  )].sort((a, b) => a - b);

  if (normalizedBuckets.length === 0) {
    throw new Error(`Metric ${name} requires at least one positive bucket`);
  }

  histogramHelp.set(name, {
    help,
    buckets: normalizedBuckets,
  });
  histograms.set(name, new Map());
};

export const incrementCounter = (
  name: string,
  labels: MetricLabels = {},
  amount = 1
): void => {
  const series = counters.get(name);
  if (!series || !Number.isFinite(amount) || amount <= 0) return;

  const key = labelKey(labels);
  const existing = series.get(key);

  if (existing) existing.value += amount;
  else series.set(key, { labels: { ...labels }, value: amount });
};

export const observeHistogram = (
  name: string,
  value: number,
  labels: MetricLabels = {}
): void => {
  const definition = histogramHelp.get(name);
  const series = histograms.get(name);
  if (!definition || !series || !Number.isFinite(value) || value < 0) return;

  const key = labelKey(labels);
  const existing = series.get(key);
  const target = existing ?? {
    labels: { ...labels },
    count: 0,
    sum: 0,
    buckets: definition.buckets.map(() => 0),
  };

  target.count += 1;
  target.sum += value;

  definition.buckets.forEach((boundary, index) => {
    if (value <= boundary) target.buckets[index] += 1;
  });

  series.set(key, target);
};

export const resetMetrics = (): void => {
  counters.forEach((series) => series.clear());
  histograms.forEach((series) => series.clear());
};

let outboxGauge = {
  pending: 0,
  processing: 0,
  oldestPendingAgeSeconds: 0,
};

export const setOutboxGaugeSnapshot = (
  pending: number,
  processing: number,
  oldestPendingAgeSeconds: number
): void => {
  outboxGauge = {
    pending: Math.max(0, Math.floor(pending)),
    processing: Math.max(0, Math.floor(processing)),
    oldestPendingAgeSeconds: Math.max(0, oldestPendingAgeSeconds),
  };
};

export const renderOutboxGauges = (): string => [
  "# HELP outbox_pending_events Pending outbox events.",
  "# TYPE outbox_pending_events gauge",
  `outbox_pending_events ${outboxGauge.pending}`,
  "# HELP outbox_processing_events Outbox events currently processing.",
  "# TYPE outbox_processing_events gauge",
  `outbox_processing_events ${outboxGauge.processing}`,
  "# HELP outbox_oldest_pending_age_seconds Age of the oldest pending outbox event.",
  "# TYPE outbox_oldest_pending_age_seconds gauge",
  `outbox_oldest_pending_age_seconds ${outboxGauge.oldestPendingAgeSeconds}`,
].join("\n") + "\n";

export const renderMetrics = (): string => {
  const lines: string[] = [];

  for (const [name, help] of counterHelp) {
    lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} counter`);

    for (const item of counters.get(name)?.values() ?? []) {
      lines.push(`${name}${renderLabels(item.labels)} ${item.value}`);
    }
  }

  for (const [name, definition] of histogramHelp) {
    lines.push(`# HELP ${name} ${definition.help}`, `# TYPE ${name} histogram`);

    for (const item of histograms.get(name)?.values() ?? []) {
      definition.buckets.forEach((boundary, index) => {
        lines.push(
          `${name}_bucket${renderLabels({
            ...item.labels,
            le: String(boundary),
          })} ${item.buckets[index]}`
        );
      });

      lines.push(
        `${name}_bucket${renderLabels({ ...item.labels, le: "+Inf" })} ${item.count}`,
        `${name}_sum${renderLabels(item.labels)} ${item.sum}`,
        `${name}_count${renderLabels(item.labels)} ${item.count}`
      );
    }
  }

  return lines.join("\n") + "\n";
};

[
  ["http_requests_total", "Total completed HTTP requests."],
  ["http_errors_total", "Total HTTP server errors."],
  ["auth_login_success_total", "Successful password logins."],
  ["auth_login_failure_total", "Failed password login attempts."],
  ["messages_created_total", "Persisted chat messages."],
  ["message_send_failures_total", "Message creation failures."],
  ["db_operation_errors_total", "Database operation failures."],
  ["socket_connections_total", "Socket.IO connections established."],
  ["socket_disconnects_total", "Socket.IO disconnects."],
  ["socket_auth_failures_total", "Rejected Socket.IO authentication attempts."],
  ["socket_reconnect_recovered_total", "Socket.IO connections with state recovery."],
  ["redis_errors_total", "Redis operation failures."],
  ["kafka_initialization_failures_total", "Kafka initialization failures."],
  ["kafka_publish_total", "Kafka publication attempts."],
  ["kafka_publish_failures_total", "Kafka publication failures."],
  ["kafka_dlq_publish_failures_total", "Kafka DLQ publication failures."],
  ["kafka_consume_total", "Kafka events processed."],
  ["kafka_consume_failures_total", "Kafka consumer processing or contract failures."],
  ["kafka_duplicate_events_total", "Duplicate Kafka events ignored."],
  ["outbox_published_total", "Outbox events published successfully."],
  ["outbox_retry_total", "Outbox retries scheduled."],
  ["outbox_dead_lettered_total", "Outbox events moved to durable dead-letter state."],
  ["outbox_metrics_collection_failures_total", "Outbox metric collection failures."],
].forEach(([name, help]) => defineCounter(name, help));

defineHistogram("http_request_duration_seconds","HTTP request duration.",[0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2,5]);
defineHistogram("db_operation_duration_seconds","Selected database operation duration.",[0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2,5]);
defineHistogram("redis_operation_duration_seconds","Selected Redis operation duration.",[0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2,5]);
defineHistogram("outbox_publication_duration_seconds","Outbox Kafka publication duration.",[0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2,5]);

export const metricsContentType = "text/plain; version=0.0.4; charset=utf-8";
