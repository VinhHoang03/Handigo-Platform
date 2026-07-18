import { inspect } from "node:util";

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

const ANSI_RESET = "\u001b[0m";
const ANSI_DIM = "\u001b[2m";
const LEVEL_COLORS = {
  INFO: "\u001b[36m",
  WARN: "\u001b[33m",
  ERROR: "\u001b[31m",
  DEBUG: "\u001b[35m",
} as const;

const isPrettyTerminal = () =>
  process.env.NODE_ENV !== "production" && Boolean(process.stdout.isTTY);

const indentMultiline = (value: string, spaces = 4) => {
  const indentation = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => `${indentation}${line}`)
    .join("\n");
};

const formatPrettyDetails = (details: unknown): string => {
  if (details instanceof Error) {
    return `\n${indentMultiline(details.stack || details.message, 2)}`;
  }

  if (typeof details === "string") {
    return `\n${indentMultiline(details, 2)}`;
  }

  if (details && typeof details === "object" && !Array.isArray(details)) {
    const lines = Object.entries(details).map(([key, value]) => {
      if (typeof value === "string" && value.includes("\n")) {
        return `  ${key}:\n${indentMultiline(value, 4)}`;
      }

      return `  ${key}: ${inspect(value, {
        colors: true,
        compact: true,
        depth: 5,
        breakLength: 100,
      })}`;
    });

    return lines.length > 0 ? `\n${lines.join("\n")}` : "";
  }

  return `\n${indentMultiline(
    inspect(details, {
      colors: true,
      compact: false,
      depth: 5,
      breakLength: 100,
    }),
    2,
  )}`;
};

const formatLog = (
  level: string,
  scope: string | undefined,
  message: string,
  details?: unknown,
) => {
  if (isPrettyTerminal()) {
    const color = LEVEL_COLORS[level as keyof typeof LEVEL_COLORS] || "";
    const now = new Date();
    const time = now.toLocaleTimeString("vi-VN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const timestamp = `${time}.${String(now.getMilliseconds()).padStart(3, "0")}`;
    const scopeLabel = scope ? ` ${scope}` : "";
    const detailText =
      details === undefined ? "" : formatPrettyDetails(details);

    return `${ANSI_DIM}${timestamp}${ANSI_RESET} ${color}${level.padEnd(5)}${ANSI_RESET}${scopeLabel}  ${message}${detailText}`;
  }

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
  error: (message, error, context) => {
    const details = {
      ...(context || {}),
      ...(error === undefined ? {} : { error: serialize(error) }),
    };
    writeLog(
      "ERROR",
      scope,
      message,
      Object.keys(details).length > 0 ? details : undefined,
    );
  },
});

export const logger = createLogger();
