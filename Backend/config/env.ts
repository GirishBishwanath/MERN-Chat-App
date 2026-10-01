import dotenv from "dotenv";

dotenv.config();

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + " environment variable is not configured");
  return value;
};

const optionalPort = (name: string, fallback: number): number => {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(name + " environment variable must be a valid TCP port");
  }
  return value;
};

const positiveInt = (name: string, fallback: number): number => {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(name + " environment variable must be a positive integer");
  }
  return value;
};

const parseCorsOrigins = (): string[] => {
  const rawOrigins = (process.env.CORS_ORIGINS || "http://localhost:3001")
    .split(",").map((origin) => origin.trim()).filter(Boolean);
  if (rawOrigins.length === 0) {
    throw new Error("CORS_ORIGINS environment variable must contain at least one origin");
  }
  return [...new Set(rawOrigins.map((origin) => {
    let parsed: URL;
    try { parsed = new URL(origin); } catch {
      throw new Error("CORS_ORIGINS contains an invalid origin");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("CORS_ORIGINS must contain only HTTP(S) origins");
    }
    return parsed.origin;
  }))];
};

const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase() || "development";
const jwtSecret = required("JWT_SECRET");
if (nodeEnv === "production" && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

const redisUrl = nodeEnv === "production"
  ? required("REDIS_URL")
  : process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";

const kafkaEnabled = (process.env.KAFKA_ENABLED?.trim().toLowerCase() ?? "false") === "true";
const kafkaBrokers = (process.env.KAFKA_BROKERS?.trim() || "127.0.0.1:29092")
  .split(",").map((broker) => broker.trim()).filter(Boolean);
if (kafkaEnabled && kafkaBrokers.length === 0) {
  throw new Error("KAFKA_BROKERS must contain at least one broker when Kafka is enabled");
}

export const config = Object.freeze({
  nodeEnv,
  port: optionalPort("PORT", 4002),
  jwtSecret,
  corsOrigins: parseCorsOrigins(),
  redis: Object.freeze({ url: redisUrl }),
  kafka: Object.freeze({
    enabled: kafkaEnabled,
    brokers: kafkaBrokers,
    clientId: process.env.KAFKA_CLIENT_ID?.trim() || "mern-chat-app-api",
    notificationConsumerGroup:
      process.env.KAFKA_NOTIFICATION_CONSUMER_GROUP?.trim() || "chat-notification-consumer",
    notificationConsumerFromBeginning:
      (process.env.KAFKA_NOTIFICATION_CONSUMER_FROM_BEGINNING?.trim().toLowerCase() ?? "false") === "true",
  }),
  postgres: Object.freeze({
    host: process.env.POSTGRES_HOST?.trim() || "127.0.0.1",
    port: optionalPort("POSTGRES_PORT", 5432),
    database: process.env.POSTGRES_DATABASE?.trim() || "mern_chat_app",
    user: process.env.POSTGRES_USER?.trim() || "postgres",
    password: required("POSTGRES_PASSWORD"),
    maxConnections: positiveInt("POSTGRES_MAX_CONNECTIONS", 10),
    idleTimeoutMs: positiveInt("POSTGRES_IDLE_TIMEOUT_MS", 10_000),
    connectionTimeoutMs: positiveInt("POSTGRES_CONNECTION_TIMEOUT_MS", 5_000),
    ssl: process.env.POSTGRES_SSL?.trim().toLowerCase() === "true"
      ? { rejectUnauthorized: nodeEnv === "production" } : false,
  }),
});

export type AppConfig = typeof config;
