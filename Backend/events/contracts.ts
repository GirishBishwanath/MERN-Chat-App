import { randomUUID } from "node:crypto";

export const MESSAGE_CREATED_EVENT = "message.created" as const;
export const MESSAGE_CREATED_VERSION = 1 as const;
export const MESSAGE_CREATED_TOPIC = "chat.message.v1" as const;
export const MESSAGE_CREATED_DLQ_TOPIC = "chat.message.dlq.v1" as const;

export interface DomainEvent<TEventType extends string, TData> {
  eventId: string;
  eventType: TEventType;
  aggregateId: string;
  occurredAt: string;
  version: number;
  correlationId: string;
  causationId: string | null;
  producer: string;
  data: TData;
}

export interface MessageCreatedData {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  createdAt: string;
}

export type MessageCreatedEvent = DomainEvent<
  typeof MESSAGE_CREATED_EVENT,
  MessageCreatedData
>;

export const createMessageCreatedEvent = (input: {
  messageId: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  createdAt: string;
  correlationId: string;
}): MessageCreatedEvent => ({
  eventId: randomUUID(),
  eventType: MESSAGE_CREATED_EVENT,
  aggregateId: input.messageId,
  occurredAt: new Date().toISOString(),
  version: MESSAGE_CREATED_VERSION,
  correlationId: input.correlationId,
  causationId: null,
  producer: "chat-api",
  data: {
    messageId: input.messageId,
    conversationId: input.conversationId,
    senderId: input.senderId,
    recipientId: input.recipientId,
    createdAt: input.createdAt,
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

export const parseMessageCreatedEvent = (value: unknown): MessageCreatedEvent => {
  if (!isRecord(value)) throw new Error("Event payload must be an object");

  const data = value.data;
  if (
    value.eventType !== MESSAGE_CREATED_EVENT ||
    value.version !== MESSAGE_CREATED_VERSION ||
    !isUuid(value.eventId) ||
    !isUuid(value.aggregateId) ||
    !isIsoTimestamp(value.occurredAt) ||
    typeof value.correlationId !== "string" ||
    value.correlationId.length === 0 ||
    value.correlationId.length > 200 ||
    (value.causationId !== null && typeof value.causationId !== "string") ||
    value.producer !== "chat-api" ||
    !isRecord(data) ||
    !isUuid(data.messageId) ||
    !isUuid(data.conversationId) ||
    !isUuid(data.senderId) ||
    !isUuid(data.recipientId) ||
    !isIsoTimestamp(data.createdAt)
  ) {
    throw new Error("Invalid message.created event");
  }

  return value as unknown as MessageCreatedEvent;
};
