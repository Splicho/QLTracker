import { Discord, Spinner } from "@/components/icon";
import { useNotificationService } from "@/hooks/use-notification-service";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export function NotificationsPage() {
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
    <section className="flex min-h-0 flex-1 flex-col px-4 py-4">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="rounded-lg border border-border p-5">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
              <Discord className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="min-w-0">
                <h1 className="text-base font-medium text-foreground">
                  {t("notifications.title")}
                </h1>
              </div>

              {!notificationsAvailable ? (
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {t("notifications.serviceUnavailable")}
                </p>
              ) : linkInFlight ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4 animate-spin" />
                  {t("notifications.finishBrowser")}
                </div>
              ) : userLoading && notificationUser == null ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4 animate-spin" />
                  {t("notifications.loadingStatus")}
                </div>
              ) : notificationUser ? (
                <>
                  <div className="mt-4 grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/70">
                        {t("notifications.account")}
                      </div>
                      <div className="mt-1 truncate text-sm text-foreground">
                        {notificationUser.globalName ??
                          notificationUser.username}
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
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {t("notifications.noAccount")}
                  </p>
                  <Button
                    type="button"
                    className="mt-4"
                    onClick={connectDiscord}
                  >
                    {t("notifications.installLink")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
