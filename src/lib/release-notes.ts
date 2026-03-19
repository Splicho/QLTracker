export const PENDING_RELEASE_NOTES_STORAGE_KEY = "qlist-pending-release-notes";
export const LAST_SEEN_RELEASE_NOTES_VERSION_STORAGE_KEY =
  "qlist-last-seen-release-notes-version";

export type PendingReleaseNotes = {
  version: string;
  body: string;
  date: string | null;
  storedAt: string;
};

export function createPendingReleaseNotes(input: {
  version: string;
  body?: string | null;
  date?: string | null;
}): PendingReleaseNotes | null {
  const version = normalizeNonEmptyString(input.version);
  const body = normalizeNonEmptyString(input.body ?? "");
  if (!version || !body) {
    return null;
  }

  return {
    version,
    body,
    date: normalizeOptionalDate(input.date ?? null),
    storedAt: new Date().toISOString(),
  };
}

export function parsePendingReleaseNotes(raw: string): PendingReleaseNotes | null {
  if (!raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      body?: unknown;
      date?: unknown;
      storedAt?: unknown;
    };
    const version = normalizeNonEmptyString(parsed.version);
    const body = normalizeNonEmptyString(parsed.body);
    const storedAt = normalizeOptionalDate(parsed.storedAt);

    if (!version || !body || !storedAt) {
      return null;
    }

    return {
      version,
      body,
      date: normalizeOptionalDate(parsed.date),
      storedAt,
    };
  } catch {
    return null;
  }
}

export function serializePendingReleaseNotes(value: PendingReleaseNotes) {
  return JSON.stringify(value);
}

export function parseReleaseNotesVersion(raw: string | null | undefined) {
  return normalizeNonEmptyString(raw ?? "");
}

export function shouldShowPendingReleaseNotes(
  pendingReleaseNotes: PendingReleaseNotes | null,
  currentVersion: string,
  lastSeenVersion: string | null
) {
  if (!pendingReleaseNotes) {
    return false;
  }

  return (
    pendingReleaseNotes.version === currentVersion &&
    lastSeenVersion !== currentVersion
  );
}

function normalizeNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeOptionalDate(value: unknown) {
  const normalizedValue = normalizeNonEmptyString(value);
  if (!normalizedValue) {
    return null;
  }

  const timestamp = Date.parse(normalizedValue);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}
