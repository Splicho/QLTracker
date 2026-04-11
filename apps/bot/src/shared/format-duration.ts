const DURATION_PARTS: ReadonlyArray<[label: string, sizeMs: number]> = [
  ['d', 24 * 60 * 60 * 1000],
  ['h', 60 * 60 * 1000],
  ['m', 60 * 1000],
  ['s', 1000]
];

export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  let remainingMs = durationMs;
  const parts: string[] = [];

  for (const [label, sizeMs] of DURATION_PARTS) {
    const value = Math.floor(remainingMs / sizeMs);

    if (value <= 0) {
      continue;
    }

    parts.push(`${value}${label}`);
    remainingMs -= value * sizeMs;
  }

  return parts.slice(0, 2).join(' ');
}
