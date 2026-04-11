import { PickupCountryFlag } from "@/components/pickup/pickup-country-flag"
import { QuakeText } from "@/lib/quake"
import { cn } from "@/lib/utils"

export function PlayerName({
  className,
  country = false,
  countryClassName,
  fallbackClassName,
  personaName,
  countryCode,
}: {
  className?: string
  country?: boolean
  countryClassName?: string
  fallbackClassName?: string
  personaName: string
  countryCode?: string | null
}) {
  return (
    <span
      className={cn("inline-flex max-w-full items-center gap-2", className)}
    >
      <QuakeText fallbackClassName={fallbackClassName} text={personaName} />
      {country ? (
        <PickupCountryFlag
          className={cn("h-4 w-4", countryClassName)}
          countryCode={countryCode}
        />
      ) : null}
    </span>
  )
}
