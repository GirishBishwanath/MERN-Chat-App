import type { Consumer } from "kafkajs";
import { MESSAGE_CREATED_DLQ_TOPIC, MESSAGE_CREATED_TOPIC, parseMessageCreatedEvent } from "./contracts.js";
import { postgresPool } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { getKafkaProducer } from "../infra/kafka/client.js";
import { config } from "../config/env.js";

let runningConsumer: Consumer | null = null;

const createNotification = async (event: ReturnType<typeof parseMessageCreatedEvent>): Promise<void> => {
  await postgresPool.query(
    `
      INSERT INTO notifications (id, recipient_id, message_id, type)
      VALUES (gen_random_uuid(), $1, $2, 'message')
      ON CONFLICT (recipient_id, message_id, type) DO NOTHING
    `,
    [event.data.recipientId, event.data.messageId]
  );
};

const publishToDlq = async (rawValue: string): Promise<void> => {
  const producer = getKafkaProducer();
  if (!producer) {
    logger.error("kafka_dlq_publish_failed", { reason: "producer_unavailable" });
    return;
  }

  await producer.send({
    topic: MESSAGE_CREATED_DLQ_TOPIC,
    messages: [{ value: rawValue }],
  });
};

export const startMessageNotificationConsumer = async (consumer: Consumer): Promise<void> => {
  await consumer.subscribe({
    topic: MESSAGE_CREATED_TOPIC,
    fromBeginning: config.kafka.notificationConsumerFromBeginning,
  });
  runningConsumer = consumer;

  const groupJoin = new Promise<void>((resolve, reject) => {
    const removeListener = consumer.on(consumer.events.GROUP_JOIN, () => {
      removeListener();
      resolve();
    });
    const timeout = setTimeout(() => {
      removeListener();
      reject(new Error("Kafka consumer group join timed out"));
    }, 10_000);
    void timeout.unref?.();
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const rawValue = message.value?.toString("utf8");
      if (!rawValue) {
        logger.error("kafka_event_invalid", { topic, partition, reason: "empty_value" });
        return;
      }

      let event: ReturnType<typeof parseMessageCreatedEvent>;
      try {
        event = parseMessageCreatedEvent(JSON.parse(rawValue) as unknown);
      } catch (error: unknown) {
        logger.error("kafka_event_invalid", {
          topic,
          partition,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        await publishToDlq(rawValue);
        return;
      }

      try {
        await createNotification(event);
        logger.info("kafka_event_processed", {
          eventId: event.eventId,
          eventType: event.eventType,
          topic,
          partition,
          consumerGroup: "chat-notification-consumer",
          correlationId: event.correlationId,
        });
      } catch (error: unknown) {
        logger.error("kafka_event_processing_failed", {
          eventId: event.eventId,
          eventType: event.eventType,
          topic,
          partition,
          correlationId: event.correlationId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        throw error;
      }
    },
  });
  await groupJoin;
};

export const stopMessageNotificationConsumer = async (): Promise<void> => {
  if (!runningConsumer) return;
  try { await runningConsumer.stop(); } catch { /* best-effort shutdown */ }
  runningConsumer = null;
};
