import { Inter } from "next/font/google"
import { cookies } from "next/headers";

import "./globals.css"
import { AppQueryProvider } from "@/components/app-query-provider";
import { RootChrome } from "@/components/root-chrome";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { createSiteMetadata } from "@/lib/seo";
import { getInitialPickupBrowserState } from "@/lib/server/pickup-browser";
import {
  RESOLVED_THEME_COOKIE_NAME,
  THEME_COOKIE_NAME,
  getServerResolvedTheme,
  isTheme,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata = createSiteMetadata();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies();
  const initialThemeValue = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const initialTheme = isTheme(initialThemeValue) ? initialThemeValue : "system";
  const initialResolvedTheme = getServerResolvedTheme(
    initialThemeValue,
    cookieStore.get(RESOLVED_THEME_COOKIE_NAME)?.value,
    initialTheme
  );
  const initialPickupState = await getInitialPickupBrowserState();

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
      <head />
      <body>
        <ThemeProvider
          defaultTheme="system"
          enableSystem
          initialResolvedTheme={initialResolvedTheme}
          initialTheme={initialTheme}
        >
          <AppQueryProvider>
            <RootChrome initialPickupState={initialPickupState}>
              {children}
            </RootChrome>
            <Toaster richColors position="bottom-right" />
          </AppQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
