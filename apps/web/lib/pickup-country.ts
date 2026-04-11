const countryDisplayNames =
  typeof Intl !== "undefined"
    ? new Intl.DisplayNames(["en"], {
        type: "region",
      })
    : null

function normalizeCountryCode(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()
  return /^[a-z]{2}$/.test(normalizedValue) ? normalizedValue : null
}

export function getPickupCountryCode(value: string | null | undefined) {
  return normalizeCountryCode(value)
}

export function getPickupCountryFlagSrc(value: string | null | undefined) {
  const countryCode = normalizeCountryCode(value)
  return countryCode ? `/images/flags/${countryCode}.png` : null
}

export function getPickupCountryName(value: string | null | undefined) {
  const countryCode = normalizeCountryCode(value)
  if (!countryCode) {
    return null
  }

  return (
    countryDisplayNames?.of(countryCode.toUpperCase()) ??
    countryCode.toUpperCase()
  )
}

export function getPickupCountryOptions() {
  return [
    "ad",
    "ae",
    "af",
    "ag",
    "ai",
    "al",
    "am",
    "ar",
    "at",
    "au",
    "az",
    "ba",
    "bb",
    "bd",
    "be",
    "bg",
    "bh",
    "bi",
    "bj",
    "bm",
    "bn",
    "bo",
    "br",
    "bs",
    "bt",
    "bw",
    "by",
    "bz",
    "ca",
    "ch",
    "cl",
    "cn",
    "co",
    "cr",
    "cu",
    "cy",
    "cz",
    "de",
    "dk",
    "do",
    "dz",
    "ec",
    "ee",
    "eg",
    "es",
    "et",
    "fi",
    "fj",
    "fr",
    "gb",
    "ge",
    "gh",
    "gr",
    "gt",
    "hk",
    "hn",
    "hr",
    "hu",
    "id",
    "ie",
    "il",
    "in",
    "iq",
    "ir",
    "is",
    "it",
    "jm",
    "jo",
    "jp",
    "ke",
    "kg",
    "kh",
    "kr",
    "kw",
    "kz",
    "la",
    "lb",
    "lk",
    "lt",
    "lu",
    "lv",
    "ma",
    "mc",
    "md",
    "me",
    "mk",
    "mn",
    "mt",
    "mu",
    "mx",
    "my",
    "ng",
    "nl",
    "no",
    "np",
    "nz",
    "om",
    "pa",
    "pe",
    "ph",
    "pk",
    "pl",
    "pt",
    "py",
    "qa",
    "ro",
    "rs",
    "ru",
    "sa",
    "se",
    "sg",
    "si",
    "sk",
    "th",
    "tr",
    "tw",
    "ua",
    "us",
    "uy",
    "uz",
    "ve",
    "vn",
    "za",
  ]
    .sort((left, right) => {
      const leftName = getPickupCountryName(left) ?? left
      const rightName = getPickupCountryName(right) ?? right
      return leftName.localeCompare(rightName)
    })
    .map((code) => ({
      code: code.toUpperCase(),
      flagSrc: getPickupCountryFlagSrc(code),
      label: getPickupCountryName(code) ?? code,
    }))
}
