"use client"

import Link from "next/link"
import { GoogleAnalytics } from "@next/third-parties/google"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  COOKIE_CONSENT_COOKIE_NAME,
  CookieConsentValue,
  getCookieConsentMaxAgeSeconds,
} from "@/lib/cookie-consent"

type CookieConsentBannerProps = {
  googleAnalyticsId: string
  initialConsent: CookieConsentValue | null
}

function writeCookieConsent(consent: CookieConsentValue) {
  if (typeof document === "undefined") {
    return
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : ""

  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${consent}; Path=/; Max-Age=${getCookieConsentMaxAgeSeconds()}; SameSite=Lax${secure}`
}

export function CookieConsentBanner({
  googleAnalyticsId,
  initialConsent,
}: CookieConsentBannerProps) {
  const [consent, setConsent] = useState<CookieConsentValue | null>(
    initialConsent
  )

  const showBanner = consent == null
  const analyticsEnabled = consent === "all" && googleAnalyticsId.length > 0

  function handleConsent(nextConsent: CookieConsentValue) {
    writeCookieConsent(nextConsent)
    setConsent(nextConsent)
  }

  return (
    <>
      <AnimatePresence>
        {showBanner ? (
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6"
          >
            <Card className="pointer-events-auto mx-auto w-full max-w-4xl gap-4 shadow-xl">
              <CardHeader className="gap-2">
                <CardTitle>Cookie Settings</CardTitle>
                <CardDescription>
                  We use essential cookies for login, security, and site
                  preferences. Analytics cookies are optional and only load if
                  you accept them.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-0">
                <p className="text-sm text-muted-foreground">
                  QLTracker does not use advertising cookies. You can keep using
                  the site with essential cookies only.
                </p>
              </CardContent>
              <CardFooter className="flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  {[
                    { href: "/privacy-policy", label: "Privacy Policy" },
                    { href: "/cookie-policy", label: "Cookie Policy" },
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleConsent("essential")}
                  >
                    Use essential only
                  </Button>
                  <Button type="button" onClick={() => handleConsent("all")}>
                    Accept all
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {analyticsEnabled ? <GoogleAnalytics gaId={googleAnalyticsId} /> : null}
    </>
  )
}
