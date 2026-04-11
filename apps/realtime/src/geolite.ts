import path from "node:path";
import maxmind, { type CountryResponse, type Reader } from "maxmind";
import { config } from "./config.js";

let countryReaderPromise: Promise<Reader<CountryResponse> | null> | null = null;

function extractHost(addr: string) {
  const lastColonIndex = addr.lastIndexOf(":");
  return lastColonIndex === -1 ? addr : addr.slice(0, lastColonIndex);
}

function mmdbPath() {
  return path.resolve(process.cwd(), config.geoliteCountryDbPath);
}

async function getCountryReader() {
  if (!countryReaderPromise) {
    const databasePath = mmdbPath();
    countryReaderPromise = maxmind
      .open<CountryResponse>(databasePath)
      .then((reader) => reader)
      .catch((error) => {
        console.warn(
          `GeoLite lookup disabled. Failed to open ${databasePath}:`,
          error
        );
        return null;
      });
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
