export type ParsedZmqMessage = {
  data: Record<string, unknown>;
  type: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseZmqMessage(raw: Buffer): ParsedZmqMessage | null {
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
    const type =
      (typeof parsed.TYPE === "string" && parsed.TYPE.trim()) || "UNKNOWN";
    const data = asObject(parsed.DATA) ?? {};

    return { data, type };
  } catch {
    return null;
  }
}
