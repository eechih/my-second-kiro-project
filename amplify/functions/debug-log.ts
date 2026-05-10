export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export function logDebug(
  functionName: string,
  message: string,
  context: LogContext = {},
): void {
  writeLog("debug", functionName, message, context);
}

export function logInfo(
  functionName: string,
  message: string,
  context: LogContext = {},
): void {
  writeLog("info", functionName, message, context);
}

export function logWarn(
  functionName: string,
  message: string,
  context: LogContext = {},
): void {
  writeLog("warn", functionName, message, context);
}

export function logError(
  functionName: string,
  message: string,
  error: unknown,
  context: LogContext = {},
): void {
  writeLog("error", functionName, message, {
    ...context,
    error: serializeError(error),
  });
}

export function getTransactionCancellationReasons(
  error: unknown,
): unknown {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  return record["CancellationReasons"] ?? record["cancellationReasons"];
}

function writeLog(
  level: LogLevel,
  functionName: string,
  message: string,
  context: LogContext,
): void {
  const payload = {
    level,
    functionName,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      name: record["name"],
      message: record["message"],
      ...record,
    };
  }

  return { message: String(error) };
}
