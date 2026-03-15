import path from "node:path";
import maxmind, { type CountryResponse, type Reader } from "maxmind";

let countryReaderPromise: Promise<Reader<CountryResponse> | null> | null = null;

function extractHost(addr: string) {
  const lastColonIndex = addr.lastIndexOf(":");
  return lastColonIndex === -1 ? addr : addr.slice(0, lastColonIndex);
}

function mmdbPath() {
  return path.resolve(process.cwd(), "GeoLite2-Country.mmdb");
}

async function getCountryReader() {
  if (!countryReaderPromise) {
    countryReaderPromise = maxmind
      .open<CountryResponse>(mmdbPath())
      .then((reader) => reader)
      .catch(() => null);
  }

  return countryReaderPromise;
}

export async function lookupCountry(addr: string) {
  const ip = extractHost(addr);
  const reader = await getCountryReader();
  const result = reader?.get(ip) ?? null;

  return {
    countryCode: result?.country?.iso_code?.toLowerCase() ?? null,
    countryName: result?.country?.names?.en ?? null,
    ip,
  };
}
