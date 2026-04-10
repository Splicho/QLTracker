import { styles as numberFlowStyles } from "@number-flow/react"
import { Inter } from "next/font/google"
import { cookies } from "next/headers"

import "./globals.css"
import { AppQueryProvider } from "@/components/app-query-provider"
import { CookieConsentBanner } from "@/components/cookie-consent-banner"
import { RootChrome } from "@/components/root-chrome"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import {
  COOKIE_CONSENT_COOKIE_NAME,
  isCookieConsentValue,
} from "@/lib/cookie-consent"
import {
  parseReadNewsSlugsCookie,
  READ_NEWS_SLUGS_COOKIE_NAME,
} from "@/lib/news-read-state"
import { createSiteMetadata } from "@/lib/seo"
import { listNewsArticleDtos } from "@/lib/server/news"
import { getInitialPickupBrowserState } from "@/lib/server/pickup-browser"
import { listPublicPickupNoticeDtos } from "@/lib/server/notices"
import {
  RESOLVED_THEME_COOKIE_NAME,
  THEME_COOKIE_NAME,
  getServerResolvedTheme,
  isTheme,
} from "@/lib/theme"
import { cn } from "@/lib/utils"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata = createSiteMetadata()

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const googleAnalyticsId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? ""
  const cookieStore = await cookies()
  const consentValue = cookieStore.get(COOKIE_CONSENT_COOKIE_NAME)?.value
  const initialReadNewsSlugs = parseReadNewsSlugsCookie(
    cookieStore.get(READ_NEWS_SLUGS_COOKIE_NAME)?.value
  )
  const initialThemeValue = cookieStore.get(THEME_COOKIE_NAME)?.value
  const initialTheme = isTheme(initialThemeValue) ? initialThemeValue : "system"
  const initialResolvedTheme = getServerResolvedTheme(
    initialThemeValue,
    cookieStore.get(RESOLVED_THEME_COOKIE_NAME)?.value,
    initialTheme
  )
  const initialCookieConsent = isCookieConsentValue(consentValue)
    ? consentValue
    : null
  const [initialNewsArticles, initialPickupState, initialNotices] =
    await Promise.all([
      listNewsArticleDtos(),
      getInitialPickupBrowserState(),
      listPublicPickupNoticeDtos(),
    ])

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        inter.variable,
        initialResolvedTheme === "dark" && "dark"
      )}
      style={{ colorScheme: initialResolvedTheme }}
    >
      <head>
        <style
          dangerouslySetInnerHTML={{ __html: numberFlowStyles.join("\n") }}
        />
      </head>
      <body>
        <ThemeProvider
          defaultTheme="system"
          enableSystem
          initialResolvedTheme={initialResolvedTheme}
          initialTheme={initialTheme}
        >
          <AppQueryProvider>
            <RootChrome
              initialNewsArticles={initialNewsArticles}
              initialNotices={initialNotices}
              initialPickupState={initialPickupState}
              initialReadNewsSlugs={initialReadNewsSlugs}
            >
              {children}
            </RootChrome>
            <Toaster richColors position="bottom-right" />
            <CookieConsentBanner
              googleAnalyticsId={googleAnalyticsId}
              initialConsent={initialCookieConsent}
            />
          </AppQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
