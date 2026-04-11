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

export function stripQuakeColors(text: string) {
  return text
    .replace(/\^\^/g, "\0")
    .replace(/\^[0-7]/g, "")
    .replace(/\0/g, "^");
}
