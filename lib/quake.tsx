import type { ReactNode } from "react";

export const QUAKE_COLOR_MAP: Record<string, string> = {
  "0": "#111111",
  "1": "#ef4444",
  "2": "#22c55e",
  "3": "#eab308",
  "4": "#3b82f6",
  "5": "#06b6d4",
  "6": "#ec4899",
  "7": "currentColor",
};

type QuakeTextProps = {
  text: string;
  fallbackClassName?: string;
};

export function stripQuakeColors(text: string) {
  return text.replace(/\^[0-7]/g, "");
}

export function renderQuakeText(text: string): ReactNode[] {
  const segments: ReactNode[] = [];
  const cleanText = text ?? "";
  let currentColor = QUAKE_COLOR_MAP["7"];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (!buffer) {
      return;
    }

    segments.push(
      <span
        key={`quake-segment-${segments.length}`}
        style={{ color: currentColor }}
      >
        {buffer}
      </span>
    );
    buffer = "";
  };

  while (index < cleanText.length) {
    if (cleanText[index] === "^" && index + 1 < cleanText.length) {
      const next = cleanText[index + 1];
      if (next in QUAKE_COLOR_MAP) {
        flush();
        currentColor = QUAKE_COLOR_MAP[next];
        index += 2;
        continue;
      }
    }

    buffer += cleanText[index];
    index += 1;
  }

  flush();

  return segments.length > 0 ? segments : [stripQuakeColors(cleanText)];
}

export function QuakeText({ text, fallbackClassName }: QuakeTextProps) {
  return <span className={fallbackClassName}>{renderQuakeText(text)}</span>;
}
