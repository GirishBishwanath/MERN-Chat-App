import { config } from "../config/env.js";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogMetadata = Record<string, unknown>;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = new Set([
  "authorization",
  "authorizationheader",
  "cookie",
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "jwt",
  "secret",
  "sessionsecret",
  "databaseurl",
  "connectionstring",
  "postgrespassword",
  "messagebody",
  "messagecontent",
  "privatemessage",
  "privateconversation",
]);

const normalizeKey = (key: string): string =>
  key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const sanitizeString = (value: string): string =>
  value
    .replace(
      /([a-z][a-z0-9+.-]*:\/\/)([^\s:@/]+):([^\s@/]+)@/gi,
      "$1[REDACTED]@"
    )
    .replace(/\bBearer\s+[^\s]+/gi, "Bearer [REDACTED]");

const sanitizeValue = (key: string, value: unknown): unknown => {
  if (SENSITIVE_KEYS.has(normalizeKey(key))) return REDACTED;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      ...(value.stack ? { stack: sanitizeString(value.stack) } : {}),
    };
  }

  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(key, item));

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      result[childKey] = sanitizeValue(childKey, childValue);
    }
    return result;
  }

  return value;
};

const write = (
  level: LogLevel,
  message: string,
  metadata: LogMetadata = {}
): void => {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[config.logLevel]) return;

  try {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: "mern-chat-app-api",
      environment: config.nodeEnv,
      message,
      ...sanitizeValue("metadata", metadata) as LogMetadata,
    };

    const output = JSON.stringify(entry);

    if (level === "error") console.error(output);
    else if (level === "warn") console.warn(output);
    else console.log(output);
  } catch (error) {
    try {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: "mern-chat-app-api",
        environment: config.nodeEnv,
        message: "logger_failure",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }));
    } catch {
      // Telemetry must never take down the process.
    }
  }
};

export const logger = Object.freeze({
  debug: (message: string, metadata?: LogMetadata): void =>
    write("debug", message, metadata ?? {}),
  info: (message: string, metadata?: LogMetadata): void =>
    write("info", message, metadata ?? {}),
  warn: (message: string, metadata?: LogMetadata): void =>
    write("warn", message, metadata ?? {}),
  error: (message: string, metadata?: LogMetadata): void =>
    write("error", message, metadata ?? {}),
});
