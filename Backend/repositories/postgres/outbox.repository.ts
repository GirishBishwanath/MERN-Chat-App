import type { Pool, PoolClient } from "pg";

import { postgresPool } from "../../db/pool.js";
import type { DomainEvent } from "../../events/contracts.js";

export type OutboxStatus = "pending" | "processing" | "published" | "dead_lettered";

export interface OutboxInsertInput<TEventType extends string, TData> {
  event: DomainEvent<TEventType, TData>;
  aggregateType: string;
  topic: string;
  partitionKey: string;
}

export interface OutboxEvent {
  id: string;
  sequenceNumber: number;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  eventVersion: number;
  topic: string;
  partitionKey: string;
  payload: DomainEvent<string, unknown>;
  headers: Record<string, string>;
  status: OutboxStatus;
  attemptCount: number;
  availableAt: Date;
  lockedUntil: Date | null;
  lastError: string | null;
  createdAt: Date;
}

const mapOutboxEvent = (row: Record<string, unknown>): OutboxEvent => ({
  id: String(row.id),
  sequenceNumber: Number(row.sequence_number),
  aggregateType: String(row.aggregate_type),
  aggregateId: String(row.aggregate_id),
  eventType: String(row.event_type),
  eventVersion: Number(row.event_version),
  topic: String(row.topic),
  partitionKey: String(row.partition_key),
  payload: row.payload as DomainEvent<string, unknown>,
  headers: (row.headers ?? {}) as Record<string, string>,
  status: String(row.status) as OutboxStatus,
  attemptCount: Number(row.attempt_count),
  availableAt: new Date(String(row.available_at)),
  lockedUntil: row.locked_until ? new Date(String(row.locked_until)) : null,
  lastError: row.last_error ? String(row.last_error) : null,
  createdAt: new Date(String(row.created_at)),
});

export const insertOutboxEvent = async <TEventType extends string, TData>(
  client: PoolClient,
  input: OutboxInsertInput<TEventType, TData>
): Promise<void> => {
  await client.query(
    `
      INSERT INTO outbox_events (
        id,
        aggregate_type,
        aggregate_id,
        event_type,
        event_version,
        topic,
        partition_key,
        payload,
        headers
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::jsonb,
        $9::jsonb
      )
    `,
    [
      input.event.eventId,
      input.aggregateType,
      input.partitionKey,
      input.event.eventType,
      input.event.version,
      input.topic,
      input.partitionKey,
      JSON.stringify(input.event),
      JSON.stringify({
        eventId: input.event.eventId,
        eventType: input.event.eventType,
        version: String(input.event.version),
        correlationId: input.event.correlationId,
      }),
    ]
  );
};

export const claimPendingOutboxEvents = async (
  pool: Pool = postgresPool,
  batchSize = 20,
  leaseMs = 30_000
): Promise<OutboxEvent[]> => {
  const boundedBatchSize = Math.min(Math.max(batchSize, 1), 100);
  const boundedLeaseMs = Math.min(Math.max(leaseMs, 1_000), 300_000);

  const result = await pool.query(
    `
      WITH candidates AS (
        SELECT candidate.id
        FROM outbox_events AS candidate
        WHERE (
          (
            candidate.status = 'pending'
            AND candidate.available_at <= NOW()
          ) OR (
            candidate.status = 'processing'
            AND candidate.locked_until <= NOW()
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM outbox_events AS earlier
          WHERE earlier.aggregate_id = candidate.aggregate_id
            AND (
              earlier.sequence_number
            ) < (
              candidate.sequence_number
            )
            AND earlier.status IN ('pending', 'processing')
        )
        ORDER BY candidate.sequence_number ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      )
      UPDATE outbox_events AS claimed
      SET
        status = 'processing',
        attempt_count = claimed.attempt_count + 1,
        locked_until = NOW() + ($2::bigint * INTERVAL '1 millisecond'),
        last_error = NULL
      FROM candidates
      WHERE claimed.id = candidates.id
      RETURNING
        claimed.id,
        claimed.sequence_number,
        claimed.aggregate_type,
        claimed.aggregate_id,
        claimed.event_type,
        claimed.event_version,
        claimed.topic,
        claimed.partition_key,
        claimed.payload,
        claimed.headers,
        claimed.status,
        claimed.attempt_count,
        claimed.available_at,
        claimed.locked_until,
        claimed.last_error,
        claimed.created_at
    `,
    [boundedBatchSize, boundedLeaseMs]
  );

  return result.rows.map((row: Record<string, unknown>) => mapOutboxEvent(row));
};

export const markOutboxEventPublished = async (
  pool: Pool = postgresPool,
  eventId: string
): Promise<void> => {
  await pool.query(
    `
      UPDATE outbox_events
      SET status = 'published',
          published_at = NOW(),
          locked_until = NULL,
          last_error = NULL
      WHERE id = $1
        AND status = 'processing'
    `,
    [eventId]
  );
};

export const rescheduleOutboxEvent = async (
  pool: Pool = postgresPool,
  eventId: string,
  nextAttemptAt: Date,
  errorMessage: string
): Promise<void> => {
  await pool.query(
    `
      UPDATE outbox_events
      SET status = 'pending',
          available_at = $2,
          locked_until = NULL,
          last_error = $3
      WHERE id = $1
        AND status = 'processing'
    `,
    [eventId, nextAttemptAt, errorMessage.slice(0, 4_000)]
  );
};

export const deadLetterOutboxEvent = async (
  pool: Pool = postgresPool,
  eventId: string,
  errorMessage: string
): Promise<void> => {
  await pool.query(
    `
      UPDATE outbox_events
      SET status = 'dead_lettered',
          locked_until = NULL,
          last_error = $2
      WHERE id = $1
        AND status = 'processing'
    `,
    [eventId, errorMessage.slice(0, 4_000)]
  );
};


export const getOutboxOperationalSnapshot = async (
  pool: Pool = postgresPool
): Promise<{
  pending: number;
  processing: number;
  oldestPendingAgeSeconds: number;
}> => {
  const result = await pool.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending,
        COUNT(*) FILTER (WHERE status = 'processing')::bigint AS processing,
        COALESCE(
          EXTRACT(
            EPOCH FROM (
              NOW() - MIN(created_at) FILTER (WHERE status = 'pending')
            )
          ),
          0
        ) AS oldest_pending_age_seconds
      FROM outbox_events
      WHERE status IN ('pending', 'processing')
    `
  );

  return {
    pending: Number(result.rows[0]?.pending ?? 0),
    processing: Number(result.rows[0]?.processing ?? 0),
    oldestPendingAgeSeconds: Number(
      result.rows[0]?.oldest_pending_age_seconds ?? 0
    ),
  };
};

export const calculateOutboxBackoffMs = (
  attemptCount: number,
  baseDelayMs = 1_000,
  maxDelayMs = 60_000
): number => {
  const exponent = Math.max(attemptCount - 1, 0);
  return Math.min(baseDelayMs * (2 ** exponent), maxDelayMs);
};
