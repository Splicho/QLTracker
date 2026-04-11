export const COOKIE_CONSENT_COOKIE_NAME = "qltracker-cookie-consent"

export const COOKIE_CONSENT_VALUES = ["essential", "all"] as const

export type CookieConsentValue = (typeof COOKIE_CONSENT_VALUES)[number]

const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function isCookieConsentValue(
  value: string | null | undefined
): value is CookieConsentValue {
  return (
    value != null && COOKIE_CONSENT_VALUES.includes(value as CookieConsentValue)
  )
}

export function getCookieConsentMaxAgeSeconds() {
  return COOKIE_CONSENT_MAX_AGE_SECONDS
}
