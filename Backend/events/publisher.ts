import type { Pool } from "pg";
import type { Producer } from "kafkajs";

import { postgresPool } from "../db/pool.js";
import {
  calculateOutboxBackoffMs,
  claimPendingOutboxEvents,
  deadLetterOutboxEvent,
  markOutboxEventPublished,
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

const publishOutboxEvent = async (
  producer: Producer,
  event: OutboxEvent
): Promise<void> => {
  const startedAt = process.hrtime.bigint();

  incrementCounter("kafka_publish_total", {
    event_type: event.eventType,
    topic: event.topic,
  });

  try {
    await producer.send({
      topic: event.topic,
      messages: [{
        key: event.partitionKey,
        value: JSON.stringify(event.payload),
        headers: event.headers,
      }],
    });

    observeHistogram(
      "outbox_publication_duration_seconds",
      Number(process.hrtime.bigint() - startedAt) / 1e9,
      { topic: event.topic }
    );
  } catch (error) {
    incrementCounter("kafka_publish_failures_total", {
      event_type: event.eventType,
      topic: event.topic,
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

  for (const event of events) {
    try {
      await publishOutboxEvent(producer, event);
      await markOutboxEventPublished(pool, event.id);

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
    } catch (error: unknown) {
      const message = errorMessage(error);

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
  }

  return events.length;
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
      await runOutboxRelayOnce(producer, pool, options);
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
