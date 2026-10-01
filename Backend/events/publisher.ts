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
  await producer.send({
    topic: event.topic,
    messages: [{
      key: event.partitionKey,
      value: JSON.stringify(event.payload),
      headers: event.headers,
    }],
  });
};

export const runOutboxRelayOnce = async (
  producer: Producer,
  pool: Pool = postgresPool,
  options: OutboxRelayOptions = {}
): Promise<number> => {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const events = await claimPendingOutboxEvents(pool, settings.batchSize, settings.leaseMs);

  for (const event of events) {
    try {
      await publishOutboxEvent(producer, event);
      await markOutboxEventPublished(pool, event.id);

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
        logger.error("outbox_event_dead_lettered", {
          outboxEventId: event.id,
          eventId: event.payload.eventId,
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          topic: event.topic,
          attemptCount: event.attemptCount,
          error: message,
        });
        continue;
      }

      const delayMs = calculateOutboxBackoffMs(
        event.attemptCount,
        settings.baseBackoffMs,
        settings.maxBackoffMs
      );
      const nextAttemptAt = new Date(Date.now() + delayMs);

      await rescheduleOutboxEvent(pool, event.id, nextAttemptAt, message);
      logger.warn("outbox_event_retry_scheduled", {
        outboxEventId: event.id,
        eventId: event.payload.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        topic: event.topic,
        attemptCount: event.attemptCount,
        retryDelayMs: delayMs,
        error: message,
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
        error: errorMessage(error),
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
