import type { Pool } from "pg";
import type { Producer } from "kafkajs";

import { postgresPool } from "../db/pool.js";
import {
  calculateOutboxBackoffMs,
  claimPendingOutboxEvents,
  deadLetterOutboxEvent,
  markOutboxEventsPublished,
  rescheduleOutboxEvent,
  type OutboxEvent,
} from "../repositories/postgres/outbox.repository.js";
import { logger } from "../utils/logger.js";
import {
  incrementCounter,
  observeHistogram,
} from "../observability/metrics.js";

export interface OutboxRelayOptions {
  batchSize?: number;
  leaseMs?: number;
  maxAttempts?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
}

const DEFAULT_OPTIONS: Required<OutboxRelayOptions> = {
  batchSize: 20,
  leaseMs: 30_000,
  maxAttempts: 8,
  baseBackoffMs: 1_000,
  maxBackoffMs: 60_000,
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown Kafka publication error";

const publishOutboxEvents = async (
  producer: Producer,
  events: OutboxEvent[]
): Promise<void> => {
  if (events.length === 0) return;

  const startedAt = process.hrtime.bigint();
  const topics = new Set(events.map((event) => event.topic));

  events.forEach((event) => {
    incrementCounter("kafka_publish_total", {
      event_type: event.eventType,
      topic: event.topic,
    });
  });

  try {
    for (const topic of topics) {
      const topicEvents = events.filter((event) => event.topic === topic);
      await producer.send({
        topic,
        messages: topicEvents.map((event) => ({
          key: event.partitionKey,
          value: JSON.stringify(event.payload),
          headers: event.headers,
        })),
      });
    }

    const durationSeconds =
      Number(process.hrtime.bigint() - startedAt) / 1e9;

    topics.forEach((topic) => {
      observeHistogram(
        "outbox_publication_duration_seconds",
        durationSeconds,
        { topic }
      );
    });
  } catch (error) {
    events.forEach((event) => {
      incrementCounter("kafka_publish_failures_total", {
        event_type: event.eventType,
        topic: event.topic,
      });
    });
    throw error;
  }
};

export const runOutboxRelayOnce = async (
  producer: Producer,
  pool: Pool = postgresPool,
  options: OutboxRelayOptions = {}
): Promise<number> => {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const events = await claimPendingOutboxEvents(
    pool,
    settings.batchSize,
    settings.leaseMs
  );

  try {
    await publishOutboxEvents(producer, events);

    if (events.length > 0) {
      await markOutboxEventsPublished(pool, events.map((event) => event.id));

      events.forEach((event) => {
        incrementCounter("outbox_published_total", {
          event_type: event.eventType,
        });

        logger.info("outbox_event_published", {
          outboxEventId: event.id,
          eventId: event.payload.eventId,
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          topic: event.topic,
          attemptCount: event.attemptCount,
          correlationId: event.payload.correlationId,
        });
      });
    }

    return events.length;
  } catch (error: unknown) {
    const message = errorMessage(error);

    for (const event of events) {
      if (event.attemptCount >= settings.maxAttempts) {
        await deadLetterOutboxEvent(pool, event.id, message);
        incrementCounter("outbox_dead_lettered_total", {
          event_type: event.eventType,
        });

        logger.error("outbox_event_dead_lettered", {
          outboxEventId: event.id,
          eventId: event.payload.eventId,
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          topic: event.topic,
          attemptCount: event.attemptCount,
          error: message,
          correlationId: event.payload.correlationId,
        });
        continue;
      }

      const delayMs = calculateOutboxBackoffMs(
        event.attemptCount,
        settings.baseBackoffMs,
        settings.maxBackoffMs
      );

      await rescheduleOutboxEvent(
        pool,
        event.id,
        new Date(Date.now() + delayMs),
        message
      );

      incrementCounter("outbox_retry_total", {
        event_type: event.eventType,
      });

      logger.warn("outbox_event_retry_scheduled", {
        outboxEventId: event.id,
        eventId: event.payload.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        topic: event.topic,
        attemptCount: event.attemptCount,
        retryDelayMs: delayMs,
        error: message,
        correlationId: event.payload.correlationId,
      });
    }

    return 0;
  }
};

let relayTimer: NodeJS.Timeout | null = null;
let relayRunning = false;

export const startOutboxRelay = (
  producer: Producer,
  pool: Pool = postgresPool,
  options: OutboxRelayOptions = {},
  pollIntervalMs = 1_000
): void => {
  if (relayTimer) return;

  const poll = async (): Promise<void> => {
    if (relayRunning) return;
    relayRunning = true;

    try {
      // Drain a bounded number of batches in one poll cycle. This is important
      // for a hot aggregate: claimPendingOutboxEvents intentionally returns
      // only the earliest unfinished event for an aggregate to preserve order.
      // Requiring another timer tick after every event would artificially cap
      // a single busy conversation at roughly one event per poll interval.
      const maxBatchesPerPoll = 100;
      for (let batch = 0; batch < maxBatchesPerPoll; batch += 1) {
        const processed = await runOutboxRelayOnce(producer, pool, options);
        if (processed === 0) break;
      }
    } catch (error: unknown) {
      logger.error("outbox_relay_failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    } finally {
      relayRunning = false;
    }
  };

  void poll();
  relayTimer = setInterval(() => void poll(), Math.max(pollIntervalMs, 100));
  relayTimer.unref();
};

export const stopOutboxRelay = (): void => {
  if (!relayTimer) return;
  clearInterval(relayTimer);
  relayTimer = null;
  relayRunning = false;
};
