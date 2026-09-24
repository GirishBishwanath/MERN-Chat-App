import { Kafka, logLevel, type Consumer, type Producer } from "kafkajs";
import { config } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { startMessageNotificationConsumer, stopMessageNotificationConsumer } from "../../events/message-notification.consumer.js";

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  logLevel: logLevel.NOTHING,
});

const producer = kafka.producer({
  idempotent: true,
  maxInFlightRequests: 5,
});
const consumer: Consumer = kafka.consumer({
  groupId: config.kafka.notificationConsumerGroup,
  allowAutoTopicCreation: false,
});

let producerConnected = false;
let consumerConnected = false;

export const getKafkaProducer = (): Producer | null => producerConnected ? producer : null;

export const initializeKafkaInfrastructure = async (): Promise<boolean> => {
  if (!config.kafka.enabled) {
    logger.info("kafka_disabled");
    return false;
  }

  try {
    await producer.connect();
    producerConnected = true;

    await consumer.connect();
    consumerConnected = true;

    await startMessageNotificationConsumer(consumer);
    logger.info("kafka_infrastructure_initialized", {
      brokers: config.kafka.brokers,
      notificationConsumerGroup: config.kafka.notificationConsumerGroup,
    });
    return true;
  } catch (error: unknown) {
    producerConnected = false;
    consumerConnected = false;
    logger.warn("kafka_initialization_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    await closeKafkaInfrastructure();
    return false;
  }
};

export const closeKafkaInfrastructure = async (): Promise<void> => {
  await stopMessageNotificationConsumer();
  if (consumerConnected) {
    try { await consumer.disconnect(); } catch { /* best-effort shutdown */ }
  }
  if (producerConnected) {
    try { await producer.disconnect(); } catch { /* best-effort shutdown */ }
  }
  consumerConnected = false;
  producerConnected = false;
};

export const getKafkaConsumer = (): Consumer => consumer;
