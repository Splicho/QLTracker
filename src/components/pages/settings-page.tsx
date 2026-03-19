import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useNotificationService } from "@/hooks/use-notification-service";
import { getLanguageFlagSrc } from "@/lib/language-flags";
import {
  MAX_FAVORITE_SERVER_ALERT_PLAYERS,
  MIN_FAVORITE_SERVER_ALERT_PLAYERS,
  SUPPORTED_APP_LANGUAGES,
  type AppLanguage,
  type AppSettingsValue,
} from "@/lib/settings";
import {
  settingsNavigationItems,
  type SettingsSectionId,
} from "@/lib/settings-navigation";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { useTranslation } from "react-i18next";

type LanguageOption = {
  value: AppLanguage;
  label: string;
  flagSrc: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallback;
}

function clampFavoriteServerAlertMinPlayers(value: number) {
  return Math.min(
    MAX_FAVORITE_SERVER_ALERT_PLAYERS,
    Math.max(MIN_FAVORITE_SERVER_ALERT_PLAYERS, Math.round(value))
  );
}

export function SettingsPage({ section }: { section: SettingsSectionId }) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAppSettings();
  const activeSection =
    settingsNavigationItems.find((item) => item.id === section) ??
    settingsNavigationItems[0];
  const languageOptions = useMemo(
    () =>
      SUPPORTED_APP_LANGUAGES.map((value) => ({
        value,
        label: t(`language.${value}`),
        flagSrc: getLanguageFlagSrc(value),
      })) as LanguageOption[],
    [t]
  );
  const selectedLanguageOption = useMemo(
    () =>
      languageOptions.find((option) => option.value === settings.language) ??
      null,
    [languageOptions, settings.language]
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col px-4 py-4">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border p-5">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
                <activeSection.icon className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-medium text-foreground">
                  {t(activeSection.titleKey)}
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t(activeSection.descriptionKey)}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {section === "general" ? (
              <GeneralSettingsPanel
                settings={settings}
                updateSettings={updateSettings}
                languageOptions={languageOptions}
                selectedLanguageOption={selectedLanguageOption}
              />
            ) : section === "startup-tray" ? (
              <StartupTraySettingsPanel
                settings={settings}
                updateSettings={updateSettings}
              />
            ) : section === "desktop-alerts" ? (
              <DesktopAlertsSettingsPanel
                settings={settings}
                updateSettings={updateSettings}
              />
            ) : section === "notifications" ? (
              <NotificationsSettingsPanel />
            ) : (
              <DiscordPresenceSettingsPanel
                settings={settings}
                updateSettings={updateSettings}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SettingsBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SettingsSwitchControl({
  ariaLabel,
  checked,
  disabled,
  onCheckedChange,
}: {
  ariaLabel: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-end">
      <Switch
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function GeneralSettingsPanel({
  settings,
  updateSettings,
  languageOptions,
  selectedLanguageOption,
}: {
  settings: AppSettingsValue;
  updateSettings: (patch: Partial<AppSettingsValue>) => void;
  languageOptions: LanguageOption[];
  selectedLanguageOption: LanguageOption | null;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <SettingsBlock
        title={t("settings.languageTitle")}
        description={t("settings.languageDescription")}
      >
        <Select
          value={settings.language}
          onValueChange={(value) => {
            updateSettings({
              language: value as AppLanguage,
            });
          }}
        >
          <SelectTrigger id="app-language" className="w-full">
            <SelectValue
              placeholder={t("settings.languagePlaceholder")}
              asChild
            >
              <span className="flex min-w-0 items-center gap-2">
                {selectedLanguageOption?.flagSrc ? (
                  <img
                    src={selectedLanguageOption.flagSrc}
                    alt=""
                    className="size-4 rounded-[2px] object-cover"
                  />
                ) : null}
                <span className="truncate">
                  {selectedLanguageOption?.label ??
                    t("settings.languagePlaceholder")}
                </span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {languageOptions.map((language) => (
              <SelectItem
                key={language.value}
                value={language.value}
                textValue={language.label}
              >
                <span className="flex items-center gap-2">
                  {language.flagSrc ? (
                    <img
                      src={language.flagSrc}
                      alt=""
                      className="size-4 rounded-[2px] object-cover"
                    />
                  ) : null}
                  <span>{language.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsBlock>
    </div>
  );
}

function StartupTraySettingsPanel({
  settings,
  updateSettings,
}: {
  settings: AppSettingsValue;
  updateSettings: (patch: Partial<AppSettingsValue>) => void;
}) {
  const { t } = useTranslation();
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(true);
  const [autostartPending, setAutostartPending] = useState(false);
  const [autostartError, setAutostartError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAutostartState() {
      setAutostartLoading(true);
      setAutostartError(null);

      try {
        const enabled = await isAutostartEnabled();
        if (!isMounted) {
          return;
        }

        setAutostartEnabled(enabled);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAutostartError(getErrorMessage(error, t("settings.unavailable")));
      } finally {
        if (isMounted) {
          setAutostartLoading(false);
        }
      }
    }

    void loadAutostartState();

    return () => {
      isMounted = false;
    };
  }, [t]);

  const handleAutostartChange = (checked: boolean) => {
    setAutostartPending(true);
    setAutostartError(null);

    void (async () => {
      try {
        if (checked) {
          await enableAutostart();
        } else {
          await disableAutostart();
        }

        setAutostartEnabled(checked);
      } catch (error) {
        setAutostartError(getErrorMessage(error, t("settings.unavailable")));
      } finally {
        setAutostartPending(false);
      }
    })();
  };

  return (
    <div className="space-y-4">
      <SettingsBlock
        title={t("settings.startupTitle")}
        description={t("settings.startupDescription")}
      >
        {autostartLoading ? (
          <div className="flex items-center justify-end text-muted-foreground">
            <Spinner className="size-4 animate-spin" />
          </div>
        ) : (
          <SettingsSwitchControl
            ariaLabel={t("settings.startupTitle")}
            checked={autostartEnabled}
            disabled={autostartPending || autostartError != null}
            onCheckedChange={handleAutostartChange}
          />
        )}

        {autostartPending ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4 animate-spin" />
            {t("settings.startupSaving")}
          </div>
        ) : null}

        {autostartError ? (
          <p className="mt-3 text-sm leading-relaxed text-destructive">
            {autostartError}
          </p>
        ) : null}
      </SettingsBlock>

      <SettingsBlock
        title={t("settings.trayModeTitle")}
        description={t("settings.trayModeDescription")}
      >
        <SettingsSwitchControl
          ariaLabel={t("settings.trayModeTitle")}
          checked={settings.trayEnabled}
          onCheckedChange={(checked) => {
            updateSettings({
              trayEnabled: checked,
              closeToTray: checked ? settings.closeToTray : false,
              startMinimizedToTray: checked
                ? settings.startMinimizedToTray
                : false,
            });
          }}
        />
      </SettingsBlock>

      <SettingsBlock
        title={t("settings.closeToTrayTitle")}
        description={t("settings.closeToTrayDescription")}
      >
        <SettingsSwitchControl
          ariaLabel={t("settings.closeToTrayTitle")}
          checked={settings.trayEnabled && settings.closeToTray}
          disabled={!settings.trayEnabled}
          onCheckedChange={(checked) => {
            updateSettings({
              closeToTray: checked,
            });
          }}
        />
      </SettingsBlock>

      <SettingsBlock
        title={t("settings.startMinimizedTitle")}
        description={t("settings.startMinimizedDescription")}
      >
        <SettingsSwitchControl
          ariaLabel={t("settings.startMinimizedTitle")}
          checked={settings.trayEnabled && settings.startMinimizedToTray}
          disabled={!settings.trayEnabled}
          onCheckedChange={(checked) => {
            updateSettings({
              startMinimizedToTray: checked,
            });
          }}
        />
      </SettingsBlock>
    </div>
  );
}

function DesktopAlertsSettingsPanel({
  settings,
  updateSettings,
}: {
  settings: AppSettingsValue;
  updateSettings: (patch: Partial<AppSettingsValue>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <SettingsBlock
        title={t("settings.desktopAlertsTitle")}
        description={t("settings.desktopAlertsDescription")}
      >
        <SettingsSwitchControl
          ariaLabel={t("settings.desktopAlertsTitle")}
          checked={settings.desktopAlertsEnabled}
          onCheckedChange={(checked) => {
            updateSettings({
              desktopAlertsEnabled: checked,
              desktopAlertsPaused: checked
                ? settings.desktopAlertsPaused
                : false,
            });
          }}
        />
      </SettingsBlock>

      <SettingsBlock
        title={t("settings.desktopAlertsPausedTitle")}
        description={t("settings.desktopAlertsPausedDescription")}
      >
        <SettingsSwitchControl
          ariaLabel={t("settings.desktopAlertsPausedTitle")}
          checked={settings.desktopAlertsEnabled && settings.desktopAlertsPaused}
          disabled={!settings.desktopAlertsEnabled}
          onCheckedChange={(checked) => {
            updateSettings({
              desktopAlertsPaused: checked,
            });
          }}
        />
      </SettingsBlock>

      <SettingsBlock
        title={t("settings.trackedPlayerAlertsTitle")}
        description={t("settings.trackedPlayerAlertsDescription")}
      >
        <SettingsSwitchControl
          ariaLabel={t("settings.trackedPlayerAlertsTitle")}
          checked={
            settings.desktopAlertsEnabled && settings.desktopAlertsTrackedPlayers
          }
          disabled={!settings.desktopAlertsEnabled}
          onCheckedChange={(checked) => {
            updateSettings({
              desktopAlertsTrackedPlayers: checked,
            });
          }}
        />
      </SettingsBlock>

      <SettingsBlock
        title={t("settings.favoriteServerAlertsTitle")}
        description={t("settings.favoriteServerAlertsDescription")}
      >
        <SettingsSwitchControl
          ariaLabel={t("settings.favoriteServerAlertsTitle")}
          checked={
            settings.desktopAlertsEnabled && settings.desktopAlertsFavoriteServers
          }
          disabled={!settings.desktopAlertsEnabled}
          onCheckedChange={(checked) => {
            updateSettings({
              desktopAlertsFavoriteServers: checked,
            });
          }}
        />

        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          <Label
            htmlFor="favorite-server-alert-threshold"
            className="text-sm font-medium text-foreground"
          >
            {t("settings.favoriteServerThresholdTitle")}
          </Label>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("settings.favoriteServerThresholdDescription")}
          </p>
          <Input
            id="favorite-server-alert-threshold"
            type="number"
            inputMode="numeric"
            min={MIN_FAVORITE_SERVER_ALERT_PLAYERS}
            max={MAX_FAVORITE_SERVER_ALERT_PLAYERS}
            disabled={
              !settings.desktopAlertsEnabled ||
              !settings.desktopAlertsFavoriteServers
            }
            value={settings.favoriteServerAlertMinPlayers}
            placeholder={t("settings.favoriteServerThresholdPlaceholder")}
            onChange={(event) => {
              const parsedValue = Number(event.target.value);
              if (!Number.isFinite(parsedValue)) {
                return;
              }

              updateSettings({
                favoriteServerAlertMinPlayers:
                  clampFavoriteServerAlertMinPlayers(parsedValue),
              });
            }}
          />
        </div>
      </SettingsBlock>
    </div>
  );
}

function NotificationsSettingsPanel() {
  const { t } = useTranslation();
  const {
    notificationsAvailable,
    linkInFlight,
    notificationUser,
    userLoading,
    rules,
    connectDiscord,
    disconnectDiscord,
  } = useNotificationService();
  const enabledRulesCount = rules.filter((rule) => rule.enabled).length;

  return (
    <div className="space-y-4">
      <SettingsBlock
        title={t("settings.discordLinkTitle")}
        description={t("settings.discordLinkDescription")}
      >
        {!notificationsAvailable ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("notifications.serviceUnavailable")}
          </p>
        ) : linkInFlight ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4 animate-spin" />
            {t("notifications.finishBrowser")}
          </div>
        ) : userLoading && notificationUser == null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4 animate-spin" />
            {t("notifications.loadingStatus")}
          </div>
        ) : notificationUser ? (
          <>
            <div className="grid gap-3 rounded-lg border border-border/70 bg-background/40 p-3 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/70">
                  {t("notifications.account")}
                </div>
                <div className="mt-1 truncate text-sm text-foreground">
                  {notificationUser.globalName ?? notificationUser.username}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/70">
                  {t("notifications.rules")}
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {t("notifications.rulesSummary", {
                    enabled: enabledRulesCount,
                    total: rules.length,
                  })}
                </div>
              </div>
            </div>

            {!notificationUser.dmAvailable ? (
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {t("notifications.dmRefused")}
              </p>
            ) : null}

            {!notificationUser.dmAvailable &&
            notificationUser.dmErrorMessage ? (
              <p className="mt-2 text-sm leading-relaxed text-destructive">
                {notificationUser.dmErrorMessage}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={connectDiscord}>
                {notificationUser.dmAvailable
                  ? t("notifications.relink")
                  : t("notifications.retryInstall")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={disconnectDiscord}
              >
                {t("notifications.disconnect")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("notifications.noAccount")}
            </p>
            <Button type="button" className="mt-4" onClick={connectDiscord}>
              {t("notifications.installLink")}
            </Button>
          </>
        )}
      </SettingsBlock>

      <SettingsBlock
        title={t("settings.notificationsManageRulesTitle")}
        description={t("settings.notificationsManageRulesDescription")}
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("settings.notificationsManageRulesHint")}
        </p>
      </SettingsBlock>
    </div>
  );
}

function DiscordPresenceSettingsPanel({
  settings,
  updateSettings,
}: {
  settings: AppSettingsValue;
  updateSettings: (patch: Partial<AppSettingsValue>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <SettingsBlock
        title={t("settings.discordPresenceTitle")}
        description={t("settings.discordPresenceDescription")}
      >
        <SettingsSwitchControl
          ariaLabel={t("settings.discordPresenceTitle")}
          checked={settings.discordPresenceEnabled}
          onCheckedChange={(checked) => {
            updateSettings({
              discordPresenceEnabled: checked,
              discordPresenceShowServerDetails: checked
                ? settings.discordPresenceShowServerDetails
                : false,
            });
          }}
        />
      </SettingsBlock>

      <SettingsBlock
        title={t("settings.discordPresenceServerTitle")}
        description={t("settings.discordPresenceServerDescription")}
      >
        <SettingsSwitchControl
          ariaLabel={t("settings.discordPresenceServerTitle")}
          checked={
            settings.discordPresenceEnabled &&
            settings.discordPresenceShowServerDetails
          }
          disabled={!settings.discordPresenceEnabled}
          onCheckedChange={(checked) => {
            updateSettings({
              discordPresenceShowServerDetails: checked,
            });
          }}
        />
      </SettingsBlock>

      <SettingsBlock
        title={t("settings.discordPresenceSteamIdTitle")}
        description={t("settings.discordPresenceSteamIdDescription")}
      >
        <Label htmlFor="discord-presence-steam-id" className="sr-only">
          {t("settings.discordPresenceSteamIdTitle")}
        </Label>
        <Input
          id="discord-presence-steam-id"
          inputMode="numeric"
          placeholder={t("settings.discordPresenceSteamIdPlaceholder")}
          value={settings.discordPresenceSteamId}
          onChange={(event) => {
            updateSettings({
              discordPresenceSteamId: event.target.value
                .replace(/\D+/g, "")
                .slice(0, 20),
            });
          }}
        />
      </SettingsBlock>
    </div>
  );
}
