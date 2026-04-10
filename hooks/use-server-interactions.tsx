import { useState } from "react";
import { ServerDrawer } from "@/components/server/server-drawer";
import { ServerPasswordDialog } from "@/components/server/server-password-dialog";
import { useServerPasswords } from "@/hooks/use-server-passwords";
import { navigateToUrl } from "@/lib/open-url";
import { buildSteamConnectUrl } from "@/lib/server-utils";
import type { SteamServer } from "@/lib/steam";

type DiscordPresenceServerContext = {
  modeLabel: string | null;
  server: SteamServer;
};

export type ServerInteractionContext = {
  server: SteamServer;
  modeLabel: string | null;
  canJoin?: boolean;
  requiresPassword?: boolean;
};

export function useServerInteractions({
  onServerLaunched,
}: {
  onServerLaunched?: (context: DiscordPresenceServerContext) => void;
}) {
  const { getPassword, savePassword } = useServerPasswords();
  const [activeServer, setActiveServer] = useState<ServerInteractionContext | null>(
    null
  );
  const [passwordContext, setPasswordContext] =
    useState<ServerInteractionContext | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [rememberServerPassword, setRememberServerPassword] = useState(false);

  const launchServer = (
    context: ServerInteractionContext,
    password?: string
  ) => {
    onServerLaunched?.({
      server: context.server,
      modeLabel: context.modeLabel,
    });
    navigateToUrl(buildSteamConnectUrl(context.server.addr, password));
  };

  const requestJoin = (context: ServerInteractionContext) => {
    if (context.canJoin === false) {
      return;
    }

    if (context.requiresPassword !== true) {
      launchServer(context);
      return;
    }

    const savedPassword = getPassword(context.server.addr);
    if (savedPassword) {
      launchServer(context, savedPassword);
      return;
    }

    setPasswordContext(context);
    setJoinPassword("");
    setRememberServerPassword(false);
  };

  return {
    openServerDetails(context: ServerInteractionContext) {
      setActiveServer(context);
    },
    requestJoin,
    overlays: (
      <>
        <ServerDrawer
          open={activeServer !== null}
          server={activeServer?.server ?? null}
          requiresPassword={activeServer?.requiresPassword === true}
          hasSavedPassword={
            activeServer ? Boolean(getPassword(activeServer.server.addr)) : false
          }
          canJoin={activeServer?.canJoin !== false}
          onOpenChange={(open) => {
            if (!open) {
              setActiveServer(null);
            }
          }}
          onJoin={() => {
            if (activeServer) {
              requestJoin(activeServer);
            }
          }}
        />

        <ServerPasswordDialog
          open={passwordContext !== null}
          server={passwordContext?.server ?? null}
          password={joinPassword}
          rememberPassword={rememberServerPassword}
          onOpenChange={(open) => {
            if (!open) {
              setPasswordContext(null);
              setJoinPassword("");
              setRememberServerPassword(false);
            }
          }}
          onPasswordChange={setJoinPassword}
          onRememberPasswordChange={setRememberServerPassword}
          onSubmit={() => {
            if (!passwordContext) {
              return;
            }

            const password = joinPassword.trim();
            if (!password) {
              return;
            }

            if (rememberServerPassword) {
              savePassword(passwordContext.server.addr, password);
            }

            launchServer(passwordContext, password);
            setPasswordContext(null);
            setJoinPassword("");
            setRememberServerPassword(false);
          }}
        />
      </>
    ),
  };
}
