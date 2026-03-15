import { useEffect, useMemo, useState } from "react";
import { Cog, Spinner } from "@/components/icon";
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
import { getLanguageFlagSrc } from "@/lib/language-flags";
import { SUPPORTED_APP_LANGUAGES, type AppLanguage } from "@/lib/settings";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { useTranslation } from "react-i18next";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallback;
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useAppSettings();
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(true);
  const [autostartPending, setAutostartPending] = useState(false);
  const [autostartError, setAutostartError] = useState<string | null>(null);
  const languageOptions = useMemo(
    () =>
      SUPPORTED_APP_LANGUAGES.map((value) => ({
        value,
        label: t(`language.${value}`),
        flagSrc: getLanguageFlagSrc(value),
      })) as Array<{
        value: AppLanguage;
        label: string;
        flagSrc: string | null;
      }>,
    [t]
  );
  const selectedLanguageOption = useMemo(
    () =>
      languageOptions.find((option) => option.value === settings.language) ??
      null,
    [languageOptions, settings.language]
  );

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

  return (
    <section className="flex min-h-0 flex-1 flex-col px-4 py-4">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="rounded-lg border border-border p-5">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
              <Cog className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-medium text-foreground">
                {t("settings.title")}
              </h1>

              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Label
                        htmlFor="startup-on-windows"
                        className="text-sm font-medium text-foreground"
                      >
                        {t("settings.startupTitle")}
                      </Label>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {t("settings.startupDescription")}
                      </p>
                    </div>
                    {autostartLoading ? (
                      <div className="flex h-9 w-11 items-center justify-center text-muted-foreground">
                        <Spinner className="size-4 animate-spin" />
                      </div>
                    ) : (
                      <Switch
                        id="startup-on-windows"
                        checked={autostartEnabled}
                        disabled={autostartPending || autostartError != null}
                        onCheckedChange={(checked) => {
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
                              setAutostartError(
                                getErrorMessage(
                                  error,
                                  t("settings.unavailable")
                                )
                              );
                            } finally {
                              setAutostartPending(false);
                            }
                          })();
                        }}
                      />
                    )}
                  </div>

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
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <Label
                    htmlFor="app-language"
                    className="text-sm font-medium text-foreground"
                  >
                    {t("settings.languageTitle")}
                  </Label>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t("settings.languageDescription")}
                  </p>

                  <Select
                    value={settings.language}
                    onValueChange={(value) => {
                      updateSettings({
                        language: value as AppLanguage,
                      });
                    }}
                  >
                    <SelectTrigger id="app-language" className="mt-3 w-full">
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
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Label
                        htmlFor="discord-presence-enabled"
                        className="text-sm font-medium text-foreground"
                      >
                        {t("settings.discordPresenceTitle")}
                      </Label>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {t("settings.discordPresenceDescription")}
                      </p>
                    </div>
                    <Switch
                      id="discord-presence-enabled"
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
                  </div>

                  <div className="mt-4 rounded-md border border-border/60 bg-background/40 p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Label
                          htmlFor="discord-presence-server-details"
                          className="text-sm font-medium text-foreground"
                        >
                          {t("settings.discordPresenceServerTitle")}
                        </Label>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {t("settings.discordPresenceServerDescription")}
                        </p>
                      </div>
                      <Switch
                        id="discord-presence-server-details"
                        checked={settings.discordPresenceShowServerDetails}
                        disabled={!settings.discordPresenceEnabled}
                        onCheckedChange={(checked) => {
                          updateSettings({
                            discordPresenceShowServerDetails: checked,
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
