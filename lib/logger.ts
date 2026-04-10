type StructuredLogPayload = {
  category: string;
  event: string;
  level: "debug" | "info" | "warn" | "error";
  payload: unknown;
  source: string;
};

export function inferLogLevel(source: string): StructuredLogPayload["level"] {
  const normalizedSource = source.toLowerCase();
  if (normalizedSource.includes("error")) {
    return "error";
  }

  if (normalizedSource.includes("warn")) {
    return "warn";
  }

  return "info";
}

export async function appendStructuredLog(entry: StructuredLogPayload) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  if (entry.level !== "error") {
    return;
  }

  console.error(`[${entry.category}] ${entry.event}`, entry.payload);
}
