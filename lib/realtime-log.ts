import { appendStructuredLog, inferLogLevel } from "@/lib/logger";

export async function appendRealtimeLog(source: string, payload: unknown) {
  const normalizedSource = source.trim();

  if (!normalizedSource) {
    return;
  }

  await appendStructuredLog({
    category: "realtime",
    level: inferLogLevel(normalizedSource),
    event: normalizedSource,
    source: normalizedSource,
    payload,
  });
}
