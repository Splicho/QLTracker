const notificationApiUrl =
  import.meta.env.VITE_NOTIFICATION_API_URL?.trim().replace(/\/$/, "") ?? "";

export const NOTIFICATION_API_URL = notificationApiUrl;

export type ThresholdMode = "min_players" | "free_slots";
export type LinkSessionStatus = "pending" | "complete" | "expired" | "error";

export type NotificationUser = {
  id: string;
  discordUserId: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  dmAvailable: boolean;
  dmErrorMessage?: string | null;
};

export type NotificationRule = {
  id: string;
  serverAddr: string;
  serverNameSnapshot: string;
  enabled: boolean;
  thresholdMode: ThresholdMode;
  thresholdValue: number;
  lastMatched: boolean;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationRuleInput = {
  serverAddr: string;
  serverNameSnapshot: string;
  thresholdMode: ThresholdMode;
  thresholdValue: number;
  enabled: boolean;
};

export type DiscordLinkSession = {
  id: string;
  authorizeUrl: string;
  expiresAt: string;
};

export type DiscordLinkSessionResult = {
  id: string;
  status: LinkSessionStatus;
  expiresAt: string;
  sessionToken?: string;
  user?: NotificationUser | null;
  errorMessage?: string | null;
};

export class NotificationApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NotificationApiError";
    this.status = status;
  }
}

function requireNotificationApiUrl() {
  if (!NOTIFICATION_API_URL) {
    throw new Error("VITE_NOTIFICATION_API_URL is not configured.");
  }

  return NOTIFICATION_API_URL;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestNotificationApi<T>(
  path: string,
  options: RequestInit = {},
  sessionToken?: string
) {
  const baseUrl = requireNotificationApiUrl();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body != null) {
    headers.set("Content-Type", "application/json");
  }
  if (sessionToken) {
    headers.set("Authorization", `Bearer ${sessionToken}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Notification API returned HTTP ${response.status}.`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Ignore invalid error bodies.
    }

    throw new NotificationApiError(message, response.status);
  }

  return parseJsonResponse<T>(response);
}

export function isNotificationApiConfigured() {
  return NOTIFICATION_API_URL.length > 0;
}

export async function createDiscordLinkSession() {
  return requestNotificationApi<DiscordLinkSession>(
    "/api/auth/discord/link-sessions",
    {
      method: "POST",
    }
  );
}

export async function fetchDiscordLinkSession(id: string) {
  return requestNotificationApi<DiscordLinkSessionResult>(
    `/api/auth/discord/link-sessions/${encodeURIComponent(id)}`
  );
}

export async function fetchNotificationMe(sessionToken: string) {
  const payload = await requestNotificationApi<{ user: NotificationUser }>(
    "/api/me",
    undefined,
    sessionToken
  );

  return payload.user;
}

export async function logoutNotificationSession(sessionToken: string) {
  return requestNotificationApi<void>(
    "/api/auth/logout",
    {
      method: "POST",
    },
    sessionToken
  );
}

export async function fetchNotificationRules(sessionToken: string) {
  const payload = await requestNotificationApi<{ rules: NotificationRule[] }>(
    "/api/notification-rules",
    undefined,
    sessionToken
  );

  return payload.rules;
}

export async function createNotificationRule(
  sessionToken: string,
  rule: NotificationRuleInput
) {
  const payload = await requestNotificationApi<{ rule: NotificationRule }>(
    "/api/notification-rules",
    {
      method: "POST",
      body: JSON.stringify(rule),
    },
    sessionToken
  );

  return payload.rule;
}

export async function updateNotificationRule(
  sessionToken: string,
  ruleId: string,
  patch: Partial<NotificationRuleInput>
) {
  const payload = await requestNotificationApi<{ rule: NotificationRule }>(
    `/api/notification-rules/${encodeURIComponent(ruleId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
    sessionToken
  );

  return payload.rule;
}

export async function deleteNotificationRule(
  sessionToken: string,
  ruleId: string
) {
  return requestNotificationApi<void>(
    `/api/notification-rules/${encodeURIComponent(ruleId)}`,
    {
      method: "DELETE",
    },
    sessionToken
  );
}
