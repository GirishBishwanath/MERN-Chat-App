type LogLevel = "info" | "warn" | "error";
type LogMetadata = Record<string, unknown>;

const write = (
  level: LogLevel,
  message: string,
  metadata: LogMetadata = {}
): void => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata,
  };

  const output = JSON.stringify(entry);
  if (level === "error") {
    console.error(output);
  } else {
    console.log(output);
  }
};

export const logger = Object.freeze({
  info: (message: string, metadata?: LogMetadata): void =>
    write("info", message, metadata),
  warn: (message: string, metadata?: LogMetadata): void =>
    write("warn", message, metadata),
  error: (message: string, metadata?: LogMetadata): void =>
    write("error", message, metadata),
});
