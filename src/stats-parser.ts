export type ParsedZmqMessage = {
  data: Record<string, unknown>;
  type: string;
};

type ParsedZmqEnvelope = Record<string, unknown> & {
  DATA?: unknown;
  TYPE?: unknown;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseFrame(raw: Buffer): ParsedZmqMessage | null {
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as ParsedZmqEnvelope;
    const type =
      (typeof parsed.TYPE === "string" && parsed.TYPE.trim()) || "UNKNOWN";
    const nestedData = asObject(parsed.DATA);
    const data =
      nestedData ??
      (() => {
        const { TYPE: _type, ...rest } = parsed;
        return asObject(rest) ?? {};
      })();

    return { data, type };
  } catch {
    return null;
  }
}

export function parseZmqMessage(raw: Buffer | readonly Buffer[]): ParsedZmqMessage | null {
  const frames = Array.isArray(raw) ? [...raw] : [raw];

  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const parsed = parseFrame(frames[index]!);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}
