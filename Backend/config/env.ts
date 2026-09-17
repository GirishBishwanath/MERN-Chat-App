import dotenv from "dotenv";

dotenv.config();

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is not configured`);
  }
  return value;
};

const optionalPort = (name: string, fallback: number): number => {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} environment variable must be a valid TCP port`);
  }
  return value;
};

const positiveInt = (name: string, fallback: number): number => {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} environment variable must be a positive integer`);
  }
  return value;
};

const port = optionalPort("PORT", 4002);

const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:3001")
  .split(",")
  .map((origin: string) => origin.trim())
  .filter(Boolean);

if (corsOrigins.length === 0) {
  throw new Error("CORS_ORIGINS environment variable must contain at least one origin");
}

const nodeEnv = process.env.NODE_ENV || "development";
const postgresSsl = process.env.POSTGRES_SSL?.trim().toLowerCase() === "true";
const redisUrl = process.env.REDIS_URL?.trim() || "redis://127.0.0.1:6379";

export const config = Object.freeze({
  nodeEnv,
  port,
  mongodbUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET"),
  corsOrigins,
  redis: Object.freeze({
    url: redisUrl,
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
    ssl: postgresSsl ? { rejectUnauthorized: nodeEnv === "production" } : false,
  }),
});

export type AppConfig = typeof config;
