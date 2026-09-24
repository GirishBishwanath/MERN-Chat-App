import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createMessageCreatedEvent } from "../events/contracts.js";
import { eventPublisher } from "../events/publisher.js";
import { closeKafkaInfrastructure, getKafkaProducer, initializeKafkaInfrastructure } from "../infra/kafka/client.js";
import { postgresPool } from "../db/pool.js";
import { runMigrations } from "../db/migrate.js";
import { createUser } from "../repositories/postgres/user.repository.js";
import { createDirectConversation } from "../repositories/postgres/conversation.repository.js";
import { createMessage } from "../repositories/postgres/message.repository.js";
import { countNotificationsForMessage } from "../repositories/postgres/notification.repository.js";

let senderId: string;
let recipientId: string;
let messageId: string;
let conversationId: string;

const waitFor = async (predicate: () => Promise<boolean>, timeoutMs = 5000): Promise<void> => {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt >= timeoutMs) throw new Error("Timed out waiting for Kafka consumer");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

before(async () => {
  await runMigrations();
  const suffix = Date.now();
  const sender = await createUser({
    fullname: "Kafka Sender",
    email: `kafka-sender-${suffix}@example.com`,
    passwordHash: "test",
  });
  const recipient = await createUser({
    fullname: "Kafka Recipient",
    email: `kafka-recipient-${suffix}@example.com`,
    passwordHash: "test",
  });
  senderId = sender.id;
  recipientId = recipient.id;

  const conversation = await createDirectConversation(senderId, recipientId);
  conversationId = conversation.id;
  const message = await createMessage({
    conversationId: conversation.id,
    senderId,
    content: "Kafka integration test message",
  });
  messageId = message.id;

  const connected = await initializeKafkaInfrastructure();
  assert.equal(connected, true);
});

after(async () => {
  await closeKafkaInfrastructure();
  await postgresPool.query(
    "TRUNCATE notifications, messages, conversation_members, conversations, users CASCADE"
  );
  await postgresPool.end();
});

test("publishes message.created and processes it into one notification", async () => {
  const event = createMessageCreatedEvent({
    messageId,
    conversationId,
    senderId,
    recipientId,
    createdAt: new Date().toISOString(),
    correlationId: "kafka-integration-test",
  });

  await eventPublisher.publishMessageCreated(event);

  await waitFor(async () => (await countNotificationsForMessage(recipientId, messageId)) === 1);

  const producer = getKafkaProducer();
  assert.ok(producer);
  await producer.send({
    topic: "chat.message.v1",
    messages: [{ key: event.data.conversationId, value: JSON.stringify(event) }],
  });

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(await countNotificationsForMessage(recipientId, messageId), 1);
});
