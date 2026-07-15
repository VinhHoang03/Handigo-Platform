type LogContext = Record<string, unknown>;

type LogMethod = (message: string, context?: LogContext) => void;

type ErrorLogMethod = (
  message: string,
  error?: unknown,
  context?: LogContext,
) => void;

interface ScopedLogger {
  info: LogMethod;
  warn: LogMethod;
  debug: LogMethod;
  error: ErrorLogMethod;
}

const serialize = (value: unknown): string => {
  if (value instanceof Error) {
    return value.stack || value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const formatLog = (
  level: string,
  scope: string | undefined,
  message: string,
  details?: unknown,
) => {
  const parts = [
    new Date().toISOString(),
    level,
    scope ? `[${scope}]` : undefined,
    message,
    details === undefined ? undefined : serialize(details),
  ].filter(Boolean);

  return parts.join(" ");
};

const writeLog = (
  level: "INFO" | "WARN" | "ERROR" | "DEBUG",
  scope: string | undefined,
  message: string,
  details?: unknown,
) => {
  if (level === "DEBUG" && process.env.NODE_ENV === "production") {
    return;
  }

  const line = formatLog(level, scope, message, details);

  if (level === "ERROR") {
    console.error(line);
    return;
  }

  if (level === "WARN") {
    console.warn(line);
    return;
  }

  if (level === "DEBUG") {
    console.debug(line);
    return;
  }

  console.info(line);
};

export const createLogger = (scope?: string): ScopedLogger => ({
  info: (message, context) => writeLog("INFO", scope, message, context),
  warn: (message, context) => writeLog("WARN", scope, message, context),
  debug: (message, context) => writeLog("DEBUG", scope, message, context),
  error: (message, error, context) =>
    writeLog("ERROR", scope, message, {
      ...(context || {}),
      error: error === undefined ? undefined : serialize(error),
    }),
});

export const logger = createLogger();
