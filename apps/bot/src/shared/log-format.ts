import type { LevelWithSilent } from 'pino';

type LogObject = {
  level?: LevelWithSilent | number;
  message?: string;
  msg?: string;
  time?: string;
  [key: string]: unknown;
};

const metadataSkipKeys = new Set(['level', 'message', 'msg', 'time']);

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => formatValue(entry)).join(', ')}]`;
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatMetadata(log: LogObject): string {
  const pairs = Object.entries(log)
    .filter(([key, value]) => !metadataSkipKeys.has(key) && value !== undefined)
    .map(([key, value]) => `${key}=${formatValue(value)}`);

  return pairs.length > 0 ? ` ${pairs.join(' ')}` : '';
}

function levelLabel(level: unknown): string {
  if (typeof level === 'string') {
    return level.toUpperCase();
  }

  switch (level) {
    case 10:
      return 'TRACE';
    case 20:
      return 'DEBUG';
    case 30:
      return 'INFO';
    case 40:
      return 'WARN';
    case 50:
      return 'ERROR';
    case 60:
      return 'FATAL';
    default:
      return 'INFO';
  }
}

export function formatLogLine(rawLine: string): string {
  const trimmed = rawLine.trim();

  if (!trimmed) {
    return '';
  }

  try {
    const parsed = JSON.parse(trimmed) as LogObject;
    const time = parsed.time ? `${parsed.time} ` : '';
    const message = parsed.message ?? parsed.msg ?? '';
    return `${time}${levelLabel(parsed.level)} ${message}${formatMetadata(parsed)}`;
  } catch {
    return trimmed;
  }
}
