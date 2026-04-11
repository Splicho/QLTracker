import {
  getPickupCountryFlagSrc,
  getPickupCountryName,
} from "@/lib/pickup-country"

export function PickupCountryFlag({
  className = "h-4 w-4 rounded-full object-cover",
  countryCode,
}: {
  className?: string
  countryCode: string | null | undefined
}) {
  const flagSrc = getPickupCountryFlagSrc(countryCode)
  const countryName = getPickupCountryName(countryCode)

  if (!flagSrc || !countryName) {
    return null
  }

  return (
    <img
      alt={countryName}
      className={className}
      src={flagSrc}
      title={countryName}
    />
  )
}
