import { useEffect, useRef } from "react";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import type { AppSettingsValue } from "@/lib/settings";

const TRAY_ID = "qltracker-main-tray";

type UseAppTrayOptions = {
  settings: Pick<
    AppSettingsValue,
    | "trayEnabled"
    | "closeToTray"
    | "startMinimizedToTray"
    | "desktopAlertsEnabled"
    | "desktopAlertsPaused"
  >;
  onRefresh?: (() => void) | null;
  updateSettings: (patch: Partial<AppSettingsValue>) => void;
};

export function useAppTray({
  settings,
  onRefresh,
  updateSettings,
}: UseAppTrayOptions) {
  const { t } = useTranslation();
  const trayRef = useRef<TrayIcon | null>(null);
  const menuRef = useRef<Menu | null>(null);
  const onRefreshRef = useRef<(() => void) | null>(onRefresh ?? null);
  const updateSettingsRef = useRef(updateSettings);
  const closeToTrayEnabledRef = useRef(false);
  const quitRequestedRef = useRef(false);
  const startHiddenOnLaunchRef = useRef(
    settings.trayEnabled && settings.startMinimizedToTray
  );

  onRefreshRef.current = onRefresh ?? null;
  updateSettingsRef.current = updateSettings;
  closeToTrayEnabledRef.current = settings.trayEnabled && settings.closeToTray;

  useEffect(() => {
    if (!startHiddenOnLaunchRef.current) {
      return;
    }

    startHiddenOnLaunchRef.current = false;
    void getCurrentWindow().hide().catch(() => undefined);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    void getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (!closeToTrayEnabledRef.current || quitRequestedRef.current) {
          return;
        }

        event.preventDefault();
        await getCurrentWindow().hide().catch(() => undefined);
      })
      .then((nextUnlisten) => {
        unlisten = nextUnlisten;
      })
      .catch(() => undefined);

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const revealMainWindow = async () => {
      const currentWindow = getCurrentWindow();
      await currentWindow.show().catch(() => undefined);
      await currentWindow.unminimize().catch(() => undefined);
      await currentWindow.setFocus().catch(() => undefined);
    };

    const shutdownTray = async () => {
      const tray =
        trayRef.current ?? (await TrayIcon.getById(TRAY_ID).catch(() => null));
      const menu = menuRef.current;

      trayRef.current = null;
      menuRef.current = null;

      await tray?.close().catch(() => undefined);
      await menu?.close().catch(() => undefined);
    };

    const buildTray = async () => {
      if (!settings.trayEnabled) {
        await shutdownTray();
        return;
      }

      const toggleAlertsLabel = !settings.desktopAlertsEnabled
        ? t("tray.enableAlerts")
        : settings.desktopAlertsPaused
          ? t("tray.resumeAlerts")
          : t("tray.pauseAlerts");
      const nextMenu = await Menu.new({
        items: [
          {
            id: "open",
            text: t("tray.open"),
            action: () => {
              void revealMainWindow();
            },
          },
          {
            id: "refresh",
            text: t("tray.refresh"),
            enabled: onRefreshRef.current != null,
            action: () => {
              onRefreshRef.current?.();
            },
          },
          {
            item: "Separator",
          },
          {
            id: "toggle-alerts",
            text: toggleAlertsLabel,
            action: () => {
              if (!settings.desktopAlertsEnabled) {
                updateSettingsRef.current({
                  desktopAlertsEnabled: true,
                  desktopAlertsPaused: false,
                });
                return;
              }

              updateSettingsRef.current({
                desktopAlertsPaused: !settings.desktopAlertsPaused,
              });
            },
          },
          {
            item: "Separator",
          },
          {
            id: "quit",
            text: t("tray.quit"),
            action: () => {
              quitRequestedRef.current = true;
              void invoke("launcher_exit_app").catch(() => {
                quitRequestedRef.current = false;
              });
            },
          },
        ],
      });

      if (cancelled) {
        await nextMenu.close().catch(() => undefined);
        return;
      }

      const icon = await defaultWindowIcon().catch(() => null);
      const existingTray =
        trayRef.current ?? (await TrayIcon.getById(TRAY_ID).catch(() => null));

      if (!existingTray) {
        trayRef.current = await TrayIcon.new({
          id: TRAY_ID,
          icon: icon ?? undefined,
          menu: nextMenu,
          tooltip: t("tray.tooltip"),
          showMenuOnLeftClick: false,
          action: (event) => {
            if (
              event.type === "Click" &&
              event.button === "Left" &&
              event.buttonState === "Up"
            ) {
              void revealMainWindow();
            }
          },
        });
      } else {
        trayRef.current = existingTray;
        await existingTray.setMenu(nextMenu).catch(() => undefined);
        await existingTray
          .setTooltip(t("tray.tooltip"))
          .catch(() => undefined);
        await existingTray.setVisible(true).catch(() => undefined);
        if (icon) {
          await existingTray.setIcon(icon).catch(() => undefined);
        }
      }

      const previousMenu = menuRef.current;
      menuRef.current = nextMenu;
      await previousMenu?.close().catch(() => undefined);
    };

    void buildTray();

    return () => {
      cancelled = true;
    };
  }, [
    settings.desktopAlertsEnabled,
    settings.desktopAlertsPaused,
    settings.trayEnabled,
    t,
  ]);

  useEffect(
    () => () => {
      const tray = trayRef.current;
      const menu = menuRef.current;
      trayRef.current = null;
      menuRef.current = null;
      void tray?.close().catch(() => undefined);
      void menu?.close().catch(() => undefined);
    },
    []
  );
}
