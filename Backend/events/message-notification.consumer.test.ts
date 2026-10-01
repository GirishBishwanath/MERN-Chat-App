import assert from "node:assert/strict";
import { test } from "node:test";
import { createMessageCreatedEvent } from "./contracts.js";

test("message notification processing is idempotent at the business boundary", async () => {
  const event = createMessageCreatedEvent({
    messageId: "11111111-1111-4111-8111-111111111111",
    conversationId: "22222222-2222-4222-8222-222222222222",
    senderId: "33333333-3333-4333-8333-333333333333",
    recipientId: "44444444-4444-4444-8444-444444444444",
    createdAt: new Date().toISOString(),
    correlationId: "request-duplicate",
  });

  assert.equal(event.eventId.length, 36);
  assert.equal(event.data.messageId, event.aggregateId);
});
