import type { Producer } from "kafkajs";
import {
  MESSAGE_CREATED_TOPIC,
  type DomainEvent,
  type MessageCreatedEvent,
} from "./contracts.js";
import { getKafkaProducer } from "../infra/kafka/client.js";
import { logger } from "../utils/logger.js";

export interface EventPublisher {
  publishMessageCreated(event: MessageCreatedEvent): Promise<void>;
}

const publish = async <TEventType extends string, TData>(
  producer: Producer,
  topic: string,
  event: DomainEvent<TEventType, TData>,
  key: string
): Promise<void> => {
  await producer.send({
    topic,
    messages: [{
      key,
      value: JSON.stringify(event),
      headers: {
        eventId: event.eventId,
        eventType: event.eventType,
        version: String(event.version),
        correlationId: event.correlationId,
      },
    }],
  });
};

export const eventPublisher: EventPublisher = {
  async publishMessageCreated(event) {
    const producer = getKafkaProducer();
    if (!producer) throw new Error("Kafka producer is unavailable");

    await publish(producer, MESSAGE_CREATED_TOPIC, event, event.data.conversationId);
    logger.info("kafka_event_published", {
      eventId: event.eventId,
      eventType: event.eventType,
      topic: MESSAGE_CREATED_TOPIC,
      aggregateId: event.aggregateId,
      correlationId: event.correlationId,
    });
  },
};
