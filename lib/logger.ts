type LogLevel = "info" | "warn" | "error";

function formatTime() {
  return new Date().toISOString();
}

function log(level: LogLevel, context: string, message: string, data?: unknown) {
  const prefix = {
    info: "INFO",
    warn: "WARN",
    error: "ERROR",
  }[level];

  const line = `[${formatTime()}] ${prefix} [${context}] ${message}`;

  if (data !== undefined) {
    if (level === "error") {
      console.error(line, data);
    } else if (level === "warn") {
      console.warn(line, data);
    } else {
      console.log(line, data);
    }
  } else {
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

export const logger = {
  info: (context: string, message: string, data?: unknown) =>
    log("info", context, message, data),
  warn: (context: string, message: string, data?: unknown) =>
    log("warn", context, message, data),
  error: (context: string, message: string, data?: unknown) =>
    log("error", context, message, data),
};

export function createLogger(context: string) {
  return {
    info: (message: string, data?: unknown) => logger.info(context, message, data),
    warn: (message: string, data?: unknown) => logger.warn(context, message, data),
    error: (message: string, data?: unknown) => logger.error(context, message, data),
  };
}
