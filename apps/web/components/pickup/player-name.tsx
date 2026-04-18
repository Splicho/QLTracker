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
  rank,
}: {
  className?: string
  country?: boolean
  countryClassName?: string
  fallbackClassName?: string
  personaName: string
  countryCode?: string | null
  rank?: {
    badgeUrl: string | null
    title: string
  } | null
}) {
  return (
    <span
      className={cn("inline-flex max-w-full items-center gap-2", className)}
    >
      <QuakeText fallbackClassName={fallbackClassName} text={personaName} />
      {rank?.badgeUrl ? (
        <img
          alt={rank.title}
          className="size-5 shrink-0 rounded-sm object-contain"
          src={rank.badgeUrl}
          title={rank.title}
        />
      ) : null}
      {country ? (
        <PickupCountryFlag
          className={cn("h-4 w-4", countryClassName)}
          countryCode={countryCode}
        />
      ) : null}
    </span>
  )
}
