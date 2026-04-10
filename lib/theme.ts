export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const THEME_COOKIE_NAME = "theme";
export const RESOLVED_THEME_COOKIE_NAME = "theme-resolved";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function isResolvedTheme(value: unknown): value is ResolvedTheme {
  return value === "light" || value === "dark";
}

export function getServerResolvedTheme(
  themeValue: unknown,
  resolvedThemeValue: unknown,
  defaultTheme: Theme = "system"
): ResolvedTheme {
  const theme = isTheme(themeValue) ? themeValue : defaultTheme;

  if (theme === "system") {
    return isResolvedTheme(resolvedThemeValue) ? resolvedThemeValue : "dark";
  }

  return theme;
}
