import { useEffect, useRef } from "react";
import {
  clearDiscordPresence,
  initializeDiscordPresence,
  setDiscordBrowsingPresence,
  setDiscordServerPresence,
  type DiscordPresenceServerContext,
} from "@/lib/discord-presence";
import type { PageId } from "@/lib/navigation";

type UseDiscordPresenceOptions = {
  enabled: boolean;
  showServerDetails: boolean;
  page: PageId;
  activeServer: DiscordPresenceServerContext | null;
};

export function useDiscordPresence({
  enabled,
  showServerDetails,
  page,
  activeServer,
}: UseDiscordPresenceOptions) {
  const updateTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (updateTimeoutRef.current != null) {
      window.clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    if (!enabled) {
      void clearDiscordPresence();
      return;
    }

    void initializeDiscordPresence();

    updateTimeoutRef.current = window.setTimeout(() => {
      if (showServerDetails && activeServer) {
        void setDiscordServerPresence(activeServer);
        return;
      }

      void setDiscordBrowsingPresence(page);
    }, 250);

    return () => {
      if (updateTimeoutRef.current != null) {
        window.clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, [activeServer, enabled, page, showServerDetails]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void clearDiscordPresence();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
}
