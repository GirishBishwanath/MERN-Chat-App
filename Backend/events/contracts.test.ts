import assert from "node:assert/strict";
import { test } from "node:test";
import { createMessageCreatedEvent, parseMessageCreatedEvent } from "./contracts.js";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];

test("creates and validates a versioned message.created event", () => {
  const event = createMessageCreatedEvent({
    messageId: ids[0],
    conversationId: ids[1],
    senderId: ids[2],
    recipientId: ids[3],
    createdAt: new Date().toISOString(),
    correlationId: "request-123",
  });

  assert.equal(parseMessageCreatedEvent(event).data.messageId, ids[0]);
});

test("rejects malformed event metadata and payloads", () => {
  const event = createMessageCreatedEvent({
    messageId: ids[0],
    conversationId: ids[1],
    senderId: ids[2],
    recipientId: ids[3],
    createdAt: new Date().toISOString(),
    correlationId: "request-123",
  });

  for (const mutation of [
    (value: Record<string, unknown>) => delete value.eventId,
    (value: Record<string, unknown>) => { value.eventType = "message.updated"; },
    (value: Record<string, unknown>) => { value.version = 2; },
    (value: Record<string, unknown>) => { (value.data as Record<string, unknown>).recipientId = "bad"; },
    (value: Record<string, unknown>) => { value.occurredAt = "not-a-date"; },
  ]) {
    const invalid = structuredClone(event) as unknown as Record<string, unknown>;
    mutation(invalid);
    assert.throws(() => parseMessageCreatedEvent(invalid));
  }
});
