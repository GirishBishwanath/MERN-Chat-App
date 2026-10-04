process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-auth-secret";
process.env.CORS_ORIGINS = "http://localhost:3001";
process.env.POSTGRES_HOST = "127.0.0.1";
process.env.POSTGRES_PORT = "5432";
process.env.POSTGRES_DATABASE = "mern_chat_app_test";
process.env.POSTGRES_USER = "postgres";
process.env.POSTGRES_PASSWORD = "postgres";
process.env.POSTGRES_SSL = "false";

import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { randomUUID } from "node:crypto";
import type { Producer } from "kafkajs";

const { postgresPool } = await import("../db/pool.js");
const { runMigrations } = await import("../db/migrate.js");
const { sendMessage } = await import("../services/message.service.js");
const { createDirectConversation } = await import("../repositories/postgres/conversation.repository.js");
const { createMessageWithClient } = await import("../repositories/postgres/message.repository.js");
const {
  insertOutboxEvent,
  claimPendingOutboxEvents,
} = await import("../repositories/postgres/outbox.repository.js");
const {
  MESSAGE_CREATED_TOPIC,
  createMessageCreatedEvent,
} = await import("../events/contracts.js");
const { runOutboxRelayOnce } = await import("../events/publisher.js");
const { processMessageCreatedEvent } = await import("../events/message-notification.consumer.js");
const { createUser } = await import("../repositories/postgres/user.repository.js");

type PublishedMessage = {
  topic: string;
  key?: string;
  value: string;
  headers?: Record<string, string>;
};

const createFakeProducer = (
  send: (message: PublishedMessage) => Promise<void>
): Producer => ({
  send: async ({ topic, messages }) => {
    for (const message of messages) {
      await send({
        topic,
        key: typeof message.key === "string" ? message.key : undefined,
        value: String(message.value),
        headers: Object.fromEntries(
          Object.entries(message.headers ?? {}).map(([key, value]) => [key, String(value)])
        ),
      });
    }
    return [];
  },
} as unknown as Producer);

const getOutboxIdByMessageId = async (messageId: string): Promise<string> => {
  const result = await postgresPool.query(
    "SELECT id FROM outbox_events WHERE payload->'data'->>'messageId' = $1",
    [messageId]
  );
  assert.equal(result.rowCount, 1);
  return String(result.rows[0].id);
};

const createUsers = async () => {
  const suffix = randomUUID();
  const sender = await createUser({
    fullname: "Outbox Sender",
    email: `outbox-sender-${suffix}@example.com`,
    passwordHash: "hash",
  });
  const receiver = await createUser({
    fullname: "Outbox Receiver",
    email: `outbox-receiver-${suffix}@example.com`,
    passwordHash: "hash",
  });
  return { sender, receiver };
};

beforeEach(async () => {
  await postgresPool.query(
    "TRUNCATE processed_events, outbox_events, notifications, sessions, messages, conversation_members, conversations, users CASCADE"
  );
});

await runMigrations();

after(async () => {
  await postgresPool.end();
});

test("message creation commits the message and outbox event atomically", async () => {
  const { sender, receiver } = await createUsers();

  const result = await sendMessage({
    senderId: sender.id,
    receiverId: receiver.id,
    message: "hello",
    correlationId: randomUUID(),
  });

  const rows = await postgresPool.query(
    "SELECT id, aggregate_id, topic, status, payload FROM outbox_events WHERE payload->'data'->>'messageId' = $1",
    [result.message._id]
  );

  assert.equal(rows.rowCount, 1);
  const conversation = await postgresPool.query(
    "SELECT conversation_id FROM messages WHERE id = $1",
    [result.message._id]
  );
  assert.equal(rows.rows[0].aggregate_id, conversation.rows[0].conversation_id);
  assert.equal(rows.rows[0].topic, MESSAGE_CREATED_TOPIC);
  assert.equal(rows.rows[0].status, "pending");
  assert.equal(rows.rows[0].payload.data.messageId, result.message._id);
});

test("a failed outbox insert rolls back the message in the same transaction", async () => {
  const { sender, receiver } = await createUsers();
  const conversation = await createDirectConversation(sender.id, receiver.id);
  const messageId = randomUUID();
  const event = createMessageCreatedEvent({
    messageId,
    conversationId: conversation.id,
    senderId: sender.id,
    recipientId: receiver.id,
    createdAt: new Date().toISOString(),
    correlationId: randomUUID(),
  });

  const client = await postgresPool.connect();
  try {
    await client.query("BEGIN");
    await createMessageWithClient(client, {
      id: messageId,
      conversationId: conversation.id,
      senderId: sender.id,
      content: "must rollback",
    });

    await assert.rejects(() =>
      insertOutboxEvent(client, {
        event,
        aggregateType: "conversation",
        topic: "x".repeat(250),
        partitionKey: conversation.id,
      })
    );

    await client.query("ROLLBACK");
  } finally {
    client.release();
  }

  const messageResult = await postgresPool.query(
    "SELECT 1 FROM messages WHERE id = $1",
    [messageId]
  );
  const outboxResult = await postgresPool.query(
    "SELECT 1 FROM outbox_events WHERE id = $1",
    [messageId]
  );

  assert.equal(messageResult.rowCount, 0);
  assert.equal(outboxResult.rowCount, 0);
});

test("relay publishes the stored event envelope and marks it published", async () => {
  const { sender, receiver } = await createUsers();
  const result = await sendMessage({
    senderId: sender.id,
    receiverId: receiver.id,
    message: "durable",
    correlationId: randomUUID(),
  });

  const outboxId = await getOutboxIdByMessageId(result.message._id);
  const published: PublishedMessage[] = [];
  const producer = createFakeProducer(async (message) => {
    published.push(message);
  });

  assert.equal(await runOutboxRelayOnce(producer, postgresPool), 1);
  assert.equal(published.length, 1);
  assert.equal(published[0].topic, MESSAGE_CREATED_TOPIC);

  const stored = await postgresPool.query(
    "SELECT status, payload FROM outbox_events WHERE id = $1",
    [outboxId]
  );

  assert.equal(stored.rows[0].status, "published");
  assert.deepEqual(JSON.parse(published[0].value), stored.rows[0].payload);
});

test("failed publication is retried with durable backoff and eventually dead-lettered", async () => {
  const { sender, receiver } = await createUsers();
  const result = await sendMessage({
    senderId: sender.id,
    receiverId: receiver.id,
    message: "retry",
    correlationId: randomUUID(),
  });

  const outboxId = await getOutboxIdByMessageId(result.message._id);
  const producer = createFakeProducer(async () => {
    throw new Error("Kafka unavailable");
  });

  await runOutboxRelayOnce(producer, postgresPool, {
    baseBackoffMs: 1_000,
    maxBackoffMs: 1_000,
    maxAttempts: 2,
  });

  let row = await postgresPool.query(
    "SELECT status, attempt_count, available_at, last_error FROM outbox_events WHERE id = $1",
    [outboxId]
  );
  assert.equal(row.rows[0].status, "pending");
  assert.equal(row.rows[0].attempt_count, 1);
  assert.equal(row.rows[0].last_error, "Kafka unavailable");
  assert.ok(new Date(row.rows[0].available_at).getTime() > Date.now());

  await postgresPool.query(
    "UPDATE outbox_events SET available_at = NOW() WHERE id = $1",
    [outboxId]
  );

  await runOutboxRelayOnce(producer, postgresPool, {
    baseBackoffMs: 1_000,
    maxBackoffMs: 1_000,
    maxAttempts: 2,
  });

  row = await postgresPool.query(
    "SELECT status, attempt_count, last_error FROM outbox_events WHERE id = $1",
    [outboxId]
  );
  assert.equal(row.rows[0].status, "dead_lettered");
  assert.equal(row.rows[0].attempt_count, 2);
  assert.equal(row.rows[0].last_error, "Kafka unavailable");
});

test("expired processing leases are reclaimed after a publisher crash", async () => {
  const { sender, receiver } = await createUsers();
  const result = await sendMessage({
    senderId: sender.id,
    receiverId: receiver.id,
    message: "recover",
    correlationId: randomUUID(),
  });

  const outboxId = await getOutboxIdByMessageId(result.message._id);
  const firstClaim = await claimPendingOutboxEvents(postgresPool, 1, 1_000);
  assert.equal(firstClaim.length, 1);
  assert.equal(firstClaim[0].id, outboxId);

  await postgresPool.query(
    "UPDATE outbox_events SET locked_until = NOW() - INTERVAL '1 second' WHERE id = $1",
    [outboxId]
  );

  const recovered = await claimPendingOutboxEvents(postgresPool, 1, 1_000);
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].id, outboxId);
  assert.equal(recovered[0].attemptCount, 2);
});

test("same conversation claims a contiguous ordered batch", async () => {
  const { sender, receiver } = await createUsers();
  const conversation = await createDirectConversation(sender.id, receiver.id);
  const firstMessageId = randomUUID();
  const secondMessageId = randomUUID();
  const thirdMessageId = randomUUID();

  const firstEvent = createMessageCreatedEvent({
    messageId: firstMessageId,
    conversationId: conversation.id,
    senderId: sender.id,
    recipientId: receiver.id,
    createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    correlationId: randomUUID(),
  });
  const secondEvent = createMessageCreatedEvent({
    messageId: secondMessageId,
    conversationId: conversation.id,
    senderId: sender.id,
    recipientId: receiver.id,
    createdAt: new Date("2026-01-01T00:00:01.000Z").toISOString(),
    correlationId: randomUUID(),
  });
  const thirdEvent = createMessageCreatedEvent({
    messageId: thirdMessageId,
    conversationId: conversation.id,
    senderId: sender.id,
    recipientId: receiver.id,
    createdAt: new Date("2026-01-01T00:00:02.000Z").toISOString(),
    correlationId: randomUUID(),
  });

  const client = await postgresPool.connect();
  try {
    await client.query("BEGIN");
    await insertOutboxEvent(client, {
      event: firstEvent,
      aggregateType: "conversation",
      topic: MESSAGE_CREATED_TOPIC,
      partitionKey: conversation.id,
    });
    await insertOutboxEvent(client, {
      event: secondEvent,
      aggregateType: "conversation",
      topic: MESSAGE_CREATED_TOPIC,
      partitionKey: conversation.id,
    });
    await insertOutboxEvent(client, {
      event: thirdEvent,
      aggregateType: "conversation",
      topic: MESSAGE_CREATED_TOPIC,
      partitionKey: conversation.id,
    });
    await client.query(
      "UPDATE outbox_events SET available_at = NOW() + INTERVAL '1 hour' WHERE id = $1",
      [secondEvent.eventId]
    );
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  const firstClaim = await claimPendingOutboxEvents(postgresPool, 10, 30_000);
  assert.equal(firstClaim.length, 1);
  assert.equal(firstClaim[0].id, firstEvent.eventId);

  await postgresPool.query(
    "UPDATE outbox_events SET status = 'published', locked_until = NULL WHERE id = $1",
    [firstEvent.eventId]
  );
  await postgresPool.query(
    "UPDATE outbox_events SET available_at = NOW() WHERE id = $1",
    [secondEvent.eventId]
  );

  const secondClaim = await claimPendingOutboxEvents(postgresPool, 10, 30_000);
  assert.deepEqual(
    secondClaim.map((event) => event.id),
    [secondEvent.eventId, thirdEvent.eventId]
  );
});

test("notification consumer ignores duplicate event delivery without duplicating the side effect", async () => {
  const { sender, receiver } = await createUsers();
  const messageId = randomUUID();
  const conversationId = randomUUID();
  const event = createMessageCreatedEvent({
    messageId,
    conversationId,
    senderId: sender.id,
    recipientId: receiver.id,
    createdAt: new Date().toISOString(),
    correlationId: randomUUID(),
  });

  await postgresPool.query(
    "INSERT INTO conversations (id, member_a_id, member_b_id) VALUES ($1, $2, $3)",
    [conversationId, sender.id < receiver.id ? sender.id : receiver.id, sender.id < receiver.id ? receiver.id : sender.id]
  );
  await postgresPool.query(
    "INSERT INTO messages (id, conversation_id, sender_id, content) VALUES ($1, $2, $3, $4)",
    [messageId, conversationId, sender.id, "duplicate-safe"]
  );

  assert.equal(await processMessageCreatedEvent(event), "processed");
  assert.equal(await processMessageCreatedEvent(event), "duplicate");

  const notifications = await postgresPool.query(
    "SELECT COUNT(*)::int AS count FROM notifications WHERE message_id = $1",
    [messageId]
  );
  const processed = await postgresPool.query(
    "SELECT COUNT(*)::int AS count FROM processed_events WHERE event_id = $1",
    [event.eventId]
  );

  assert.equal(notifications.rows[0].count, 1);
  assert.equal(processed.rows[0].count, 1);
});
