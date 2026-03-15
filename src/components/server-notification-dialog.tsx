import { useEffect, useMemo, useState } from "react";
import type { SteamServer } from "@/lib/steam";
import {
  type NotificationRule,
  type NotificationRuleInput,
  type ThresholdMode,
} from "@/lib/notifications";
import { getDefaultNotificationThreshold } from "@/hooks/use-notification-service";
import { stripQuakeColors } from "@/lib/quake";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useTranslation } from "react-i18next";

const thresholdModeOptions: Array<{
  value: ThresholdMode;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "active_free_slots",
    labelKey: "notifications.dialog.mode.active_free_slots.label",
    descriptionKey: "notifications.dialog.mode.active_free_slots.description",
  },
  {
    value: "free_slots",
    labelKey: "notifications.dialog.mode.free_slots.label",
    descriptionKey: "notifications.dialog.mode.free_slots.description",
  },
  {
    value: "min_players",
    labelKey: "notifications.dialog.mode.min_players.label",
    descriptionKey: "notifications.dialog.mode.min_players.description",
  },
];

function inferMatchCapacity(server: SteamServer | null) {
  if (!server) {
    return 8;
  }

  const match = stripQuakeColors(server.name).match(
    /(\d{1,2})\s*v\s*(\d{1,2})/i
  );
  if (!match) {
    return Math.max(server.max_players, 1);
  }

  const left = Number(match[1]);
  const right = Number(match[2]);

  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return Math.max(server.max_players, 1);
  }

  return Math.min(Math.max(left + right, 1), Math.max(server.max_players, 1));
}

type ServerNotificationDialogProps = {
  open: boolean;
  server: SteamServer | null;
  existingRule: NotificationRule | null;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: NotificationRuleInput, existingRuleId: string | null) => void;
  onDelete: (ruleId: string) => void;
};

export function ServerNotificationDialog({
  open,
  server,
  existingRule,
  pending = false,
  onOpenChange,
  onSave,
  onDelete,
}: ServerNotificationDialogProps) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(true);
  const [thresholdMode, setThresholdMode] =
    useState<ThresholdMode>("free_slots");
  const [thresholdValue, setThresholdValue] = useState("1");
  const [matchCapacity, setMatchCapacity] = useState("8");

  useEffect(() => {
    if (!open || !server) {
      return;
    }

    if (existingRule) {
      setEnabled(existingRule.enabled);
      setThresholdMode(existingRule.thresholdMode);
      setThresholdValue(String(existingRule.thresholdValue));
      setMatchCapacity(
        String(existingRule.matchCapacity ?? inferMatchCapacity(server))
      );
      return;
    }

    const defaultMode: ThresholdMode = "free_slots";
    setEnabled(true);
    setThresholdMode(defaultMode);
    setThresholdValue(
      String(getDefaultNotificationThreshold(server.max_players, defaultMode))
    );
    setMatchCapacity(String(inferMatchCapacity(server)));
  }, [existingRule, open, server]);

  const maxThreshold = useMemo(
    () => Math.max(server?.max_players ?? 1, 1),
    [server?.max_players]
  );
  const minThreshold = thresholdMode === "min_players" ? 1 : 0;
  const normalizedMatchCapacity = Number.isFinite(Number(matchCapacity))
    ? Math.min(Math.max(Number(matchCapacity), 1), maxThreshold)
    : Math.min(inferMatchCapacity(server), maxThreshold);
  const normalizedThresholdValue = Number.isFinite(Number(thresholdValue))
    ? Math.min(Math.max(Number(thresholdValue), minThreshold), maxThreshold)
    : minThreshold;
  const normalizedRuleThresholdValue =
    thresholdMode === "active_free_slots"
      ? Math.min(normalizedThresholdValue, normalizedMatchCapacity)
      : normalizedThresholdValue;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {existingRule
              ? t("notifications.dialog.editTitle")
              : t("notifications.dialog.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {server
              ? t("notifications.dialog.descriptionWithServer", {
                  server: stripQuakeColors(server.name),
                })
              : t("notifications.dialog.descriptionFallback")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="notification-enabled">
                {t("notifications.dialog.enabled")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("notifications.dialog.enabledDescription")}
              </p>
            </div>
            <Switch
              id="notification-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("notifications.dialog.thresholdType")}</Label>
            <Select
              value={thresholdMode}
              onValueChange={(value) => {
                const nextMode = value as ThresholdMode;
                setThresholdMode(nextMode);
                if (nextMode === "active_free_slots") {
                  setMatchCapacity(String(inferMatchCapacity(server)));
                }
                setThresholdValue(
                  String(
                    Math.min(
                      Math.max(
                        normalizedRuleThresholdValue,
                        nextMode === "min_players" ? 1 : 0
                      ),
                      nextMode === "active_free_slots"
                        ? normalizedMatchCapacity
                        : maxThreshold
                    )
                  )
                );
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t("notifications.dialog.thresholdPlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {thresholdModeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {thresholdModeOptions.find(
                (option) => option.value === thresholdMode
              )?.descriptionKey
                ? t(
                    thresholdModeOptions.find(
                      (option) => option.value === thresholdMode
                    )!.descriptionKey
                  )
                : null}
            </p>
          </div>

          {thresholdMode === "active_free_slots" ? (
            <div className="grid gap-2">
              <Label htmlFor="notification-match-capacity">
                {t("notifications.dialog.totalPlayingSlots")}
              </Label>
              <Input
                id="notification-match-capacity"
                type="number"
                min={1}
                max={maxThreshold}
                value={matchCapacity}
                onChange={(event) => setMatchCapacity(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("notifications.dialog.totalPlayingSlotsDescription")}
              </p>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="notification-threshold">
              {thresholdMode === "min_players"
                ? t("notifications.dialog.minimumPlayerCount")
                : thresholdMode === "active_free_slots"
                  ? t("notifications.dialog.maximumActiveSlotsLeft")
                  : t("notifications.dialog.maximumFreeSlots")}
            </Label>
            <Input
              id="notification-threshold"
              type="number"
              min={minThreshold}
              max={
                thresholdMode === "active_free_slots"
                  ? normalizedMatchCapacity
                  : maxThreshold
              }
              value={thresholdValue}
              onChange={(event) => setThresholdValue(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {thresholdMode === "active_free_slots"
                ? t("notifications.dialog.activeSlotsDescription", {
                    count: normalizedMatchCapacity,
                  })
                : t("notifications.dialog.serverSupportsDescription", {
                    count: maxThreshold,
                  })}
            </p>
          </div>
        </div>

        <DialogFooter>
          {existingRule ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                onDelete(existingRule.id);
              }}
            >
              {t("notifications.dialog.deleteRule")}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={!server || pending}
            onClick={() => {
              if (!server) {
                return;
              }

              onSave(
                {
                  serverAddr: server.addr,
                  serverNameSnapshot: stripQuakeColors(server.name),
                  enabled,
                  thresholdMode,
                  thresholdValue: normalizedRuleThresholdValue,
                  matchCapacity:
                    thresholdMode === "active_free_slots"
                      ? normalizedMatchCapacity
                      : null,
                },
                existingRule?.id ?? null
              );
            }}
          >
            {existingRule
              ? t("notifications.dialog.saveChanges")
              : t("notifications.dialog.createRule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
