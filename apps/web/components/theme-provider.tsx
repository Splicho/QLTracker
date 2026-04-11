"use client"

import * as React from "react"
import {
  RESOLVED_THEME_COOKIE_NAME,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
  isTheme,
} from "@/lib/theme"

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  theme: Theme
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "dark"
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme
}

function applyTheme(theme: Theme) {
  const resolvedTheme = resolveTheme(theme)
  const root = document.documentElement

  root.classList.toggle("dark", resolvedTheme === "dark")
  root.style.colorScheme = resolvedTheme

  return resolvedTheme
}

function writeThemeCookies(theme: Theme, resolvedTheme: ResolvedTheme) {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : ""
  const baseAttributes = `; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`

  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)}${baseAttributes}`
  document.cookie = `${RESOLVED_THEME_COOKIE_NAME}=${resolvedTheme}${baseAttributes}`
}

function persistTheme(theme: Theme) {
  const resolvedTheme = applyTheme(theme)

  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  writeThemeCookies(theme, resolvedTheme)

  return resolvedTheme
}

function readTheme(defaultTheme: Theme): Theme {
  if (typeof window === "undefined") {
    return defaultTheme
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isTheme(storedTheme) ? storedTheme : defaultTheme
}

function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key.toLowerCase() !== "d") {
        return
      }

      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return
      }

      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [resolvedTheme, setTheme])

  return null
}

function ThemeProvider({
  children,
  defaultTheme = "system",
  initialResolvedTheme = "dark",
  initialTheme,
}: {
  children: React.ReactNode
  defaultTheme?: Theme
  enableSystem?: boolean
  initialResolvedTheme?: ResolvedTheme
  initialTheme?: Theme
}) {
  const [theme, setThemeState] = React.useState<Theme>(
    () => initialTheme ?? defaultTheme
  )
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(
    () => initialResolvedTheme
  )

  React.useEffect(() => {
    const nextTheme = readTheme(defaultTheme)
    setThemeState(nextTheme)
    setResolvedTheme(persistTheme(nextTheme))
  }, [defaultTheme])

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = () => {
      if (theme !== "system") {
        return
      }

      setResolvedTheme(persistTheme("system"))
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  const setTheme = React.useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme)
    setResolvedTheme(persistTheme(nextTheme))
  }, [])

  const value = React.useMemo(
    () => ({
      resolvedTheme,
      setTheme,
      theme,
    }),
    [resolvedTheme, setTheme, theme]
  )

  return (
    <ThemeContext.Provider value={value}>
      <ThemeHotkey />
      {children}
    </ThemeContext.Provider>
  )
}

function useTheme() {
  const context = React.useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.")
  }

  return context
}

export { ThemeProvider, useTheme }
