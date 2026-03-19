export const PENDING_RELEASE_NOTES_STORAGE_KEY = "qlist-pending-release-notes";
export const LAST_SEEN_RELEASE_NOTES_VERSION_STORAGE_KEY =
  "qlist-last-seen-release-notes-version";
export const RELEASE_NOTES_RECOVERY_VERSION_STORAGE_KEY =
  "qlist-release-notes-recovery-version";

const GITHUB_RELEASES_API_URL =
  "https://api.github.com/repos/Splicho/QLTracker/releases";
const GITHUB_RELEASE_NOTES_FETCH_TIMEOUT_MS = 5000;

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

export function extractReleaseNotesBody(input: {
  body?: string | null;
  rawJson?: Record<string, unknown> | null;
}) {
  return (
    normalizeNonEmptyString(input.body ?? "") ??
    normalizeNonEmptyString(input.rawJson?.notes)
  );
}

export async function resolvePendingReleaseNotes(input: {
  version: string;
  body?: string | null;
  date?: string | null;
  rawJson?: Record<string, unknown> | null;
}) {
  const version = parseReleaseNotesVersion(input.version);
  if (!version) {
    return null;
  }

  const directPendingReleaseNotes = createPendingReleaseNotes({
    version,
    body: extractReleaseNotesBody(input),
    date: input.date,
  });
  if (directPendingReleaseNotes) {
    return directPendingReleaseNotes;
  }

  return fetchGitHubReleaseNotes(version);
}

export async function fetchGitHubReleaseNotes(version: string) {
  const normalizedVersion = parseReleaseNotesVersion(version);
  if (!normalizedVersion) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, GITHUB_RELEASE_NOTES_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${GITHUB_RELEASES_API_URL}/tags/${encodeURIComponent(
        getReleaseTag(normalizedVersion)
      )}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
        },
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      body?: unknown;
      published_at?: unknown;
      created_at?: unknown;
    };

    return createPendingReleaseNotes({
      version: normalizedVersion,
      body: normalizeNonEmptyString(payload.body),
      date:
        normalizeOptionalDate(payload.published_at) ??
        normalizeOptionalDate(payload.created_at),
    });
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
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

function getReleaseTag(version: string) {
  return version.startsWith("v") ? version : `v${version}`;
}

function normalizeOptionalDate(value: unknown) {
  const normalizedValue = normalizeNonEmptyString(value);
  if (!normalizedValue) {
    return null;
  }

  const timestamp = Date.parse(normalizedValue);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}
