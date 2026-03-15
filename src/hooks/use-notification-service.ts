import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  createDiscordLinkSession,
  createNotificationRule,
  deleteNotificationRule,
  fetchDiscordLinkSession,
  fetchNotificationMe,
  fetchNotificationRules,
  isNotificationApiConfigured,
  logoutNotificationSession,
  NotificationApiError,
  type NotificationRuleInput,
  type ThresholdMode,
  updateNotificationRule,
} from "@/lib/notifications";

const NOTIFICATION_SESSION_STORAGE_KEY = "qltracker-notification-session";

export function getDefaultNotificationThreshold(
  maxPlayers: number,
  thresholdMode: ThresholdMode
) {
  if (thresholdMode === "min_players") {
    return Math.max(Math.min(maxPlayers - 1, maxPlayers), 1);
  }

  return Math.min(1, maxPlayers);
}

export function useNotificationService() {
  const queryClient = useQueryClient();
  const notificationsAvailable = isNotificationApiConfigured();
  const [rawSessionToken, setRawSessionToken] = useLocalStorage(
    NOTIFICATION_SESSION_STORAGE_KEY,
    ""
  );
  const sessionToken = rawSessionToken.trim();
  const [linkSessionId, setLinkSessionId] = useState<string | null>(null);
  const [handledLinkState, setHandledLinkState] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["notifications", "me", sessionToken],
    queryFn: () => fetchNotificationMe(sessionToken),
    enabled: notificationsAvailable && sessionToken.length > 0,
    retry: false,
  });

  const rulesQuery = useQuery({
    queryKey: ["notifications", "rules", sessionToken],
    queryFn: () => fetchNotificationRules(sessionToken),
    enabled: notificationsAvailable && sessionToken.length > 0,
    retry: false,
  });

  useEffect(() => {
    const error = meQuery.error ?? rulesQuery.error;
    if (
      error instanceof NotificationApiError &&
      error.status === 401 &&
      sessionToken.length > 0
    ) {
      setRawSessionToken("");
    }
  }, [meQuery.error, rulesQuery.error, sessionToken, setRawSessionToken]);

  const linkSessionQuery = useQuery({
    queryKey: ["notifications", "link-session", linkSessionId],
    queryFn: () => fetchDiscordLinkSession(linkSessionId!),
    enabled: notificationsAvailable && linkSessionId !== null,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2000 : false,
  });

  useEffect(() => {
    const result = linkSessionQuery.data;
    if (!result || handledLinkState === result.id) {
      return;
    }

    if (result.status === "complete" && result.sessionToken) {
      setHandledLinkState(result.id);
      setRawSessionToken(result.sessionToken);
      setLinkSessionId(null);
      toast.success("Discord linked.");
      void queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
      return;
    }

    if (result.status === "expired" || result.status === "error") {
      setHandledLinkState(result.id);
      setLinkSessionId(null);
      toast.error(result.errorMessage ?? "Discord connection did not complete.");
    }
  }, [
    handledLinkState,
    linkSessionQuery.data,
    queryClient,
    setRawSessionToken,
  ]);

  const connectMutation = useMutation({
    mutationFn: createDiscordLinkSession,
    onSuccess: async (result) => {
      setHandledLinkState(null);
      setLinkSessionId(result.id);
      await openUrl(result.authorizeUrl);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not start the Discord link flow."
      );
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!sessionToken) {
        return;
      }

      await logoutNotificationSession(sessionToken);
    },
    onSettled: () => {
      setRawSessionToken("");
      setLinkSessionId(null);
      void queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: (input: NotificationRuleInput) =>
      createNotificationRule(sessionToken, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notifications", "rules"],
      });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({
      ruleId,
      patch,
    }: {
      ruleId: string;
      patch: Partial<NotificationRuleInput>;
    }) => updateNotificationRule(sessionToken, ruleId, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notifications", "rules"],
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => deleteNotificationRule(sessionToken, ruleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notifications", "rules"],
      });
    },
  });

  const rulesByServerAddr = useMemo(
    () =>
      Object.fromEntries(
        (rulesQuery.data ?? []).map((rule) => [rule.serverAddr, rule])
      ),
    [rulesQuery.data]
  );

  return {
    notificationsAvailable,
    sessionToken,
    linkInFlight:
      connectMutation.isPending ||
      linkSessionQuery.fetchStatus === "fetching" ||
      linkSessionId !== null,
    notificationUser: meQuery.data ?? null,
    userLoading: meQuery.isLoading,
    rules: rulesQuery.data ?? [],
    rulesByServerAddr,
    rulesLoading: rulesQuery.isLoading,
    connectDiscord: () => connectMutation.mutate(),
    disconnectDiscord: () => disconnectMutation.mutate(),
    createRule: createRuleMutation.mutateAsync,
    updateRule: updateRuleMutation.mutateAsync,
    deleteRule: deleteRuleMutation.mutateAsync,
    mutationsPending:
      createRuleMutation.isPending ||
      updateRuleMutation.isPending ||
      deleteRuleMutation.isPending,
  };
}
