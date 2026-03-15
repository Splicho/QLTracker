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

const thresholdModeOptions: Array<{
  value: ThresholdMode;
  label: string;
  description: string;
}> = [
  {
    value: "free_slots",
    label: "Free slots",
    description: "Notify when the server has this many free slots or fewer.",
  },
  {
    value: "min_players",
    label: "Min players",
    description: "Notify when the server reaches at least this many players.",
  },
];

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
  const [enabled, setEnabled] = useState(true);
  const [thresholdMode, setThresholdMode] =
    useState<ThresholdMode>("free_slots");
  const [thresholdValue, setThresholdValue] = useState("1");

  useEffect(() => {
    if (!open || !server) {
      return;
    }

    if (existingRule) {
      setEnabled(existingRule.enabled);
      setThresholdMode(existingRule.thresholdMode);
      setThresholdValue(String(existingRule.thresholdValue));
      return;
    }

    const defaultMode: ThresholdMode = "free_slots";
    setEnabled(true);
    setThresholdMode(defaultMode);
    setThresholdValue(
      String(getDefaultNotificationThreshold(server.max_players, defaultMode))
    );
  }, [existingRule, open, server]);

  const maxThreshold = useMemo(
    () => Math.max(server?.max_players ?? 1, 1),
    [server?.max_players]
  );
  const minThreshold = thresholdMode === "min_players" ? 1 : 0;
  const normalizedThresholdValue = Number.isFinite(Number(thresholdValue))
    ? Math.min(Math.max(Number(thresholdValue), minThreshold), maxThreshold)
    : minThreshold;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {existingRule ? "Edit Discord Notification" : "Discord Notification"}
          </DialogTitle>
          <DialogDescription>
            {server ? (
              <>
                Configure a Discord DM notification for{" "}
                <span className="font-medium text-foreground">
                  {stripQuakeColors(server.name)}
                </span>
                .
              </>
            ) : (
              "Configure a Discord DM notification for this server."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="notification-enabled">Enabled</Label>
              <p className="text-xs text-muted-foreground">
                Only send DMs while this rule is enabled.
              </p>
            </div>
            <Switch
              id="notification-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="grid gap-2">
            <Label>Threshold type</Label>
            <Select
              value={thresholdMode}
              onValueChange={(value) => {
                const nextMode = value as ThresholdMode;
                setThresholdMode(nextMode);
                setThresholdValue(
                  String(
                    Math.min(
                      Math.max(
                        normalizedThresholdValue,
                        nextMode === "min_players" ? 1 : 0
                      ),
                      maxThreshold
                    )
                  )
                );
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a threshold type" />
              </SelectTrigger>
              <SelectContent>
                {thresholdModeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {
                thresholdModeOptions.find(
                  (option) => option.value === thresholdMode
                )?.description
              }
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notification-threshold">
              {thresholdMode === "min_players"
                ? "Minimum player count"
                : "Maximum free slots"}
            </Label>
            <Input
              id="notification-threshold"
              type="number"
              min={minThreshold}
              max={maxThreshold}
              value={thresholdValue}
              onChange={(event) => setThresholdValue(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This server currently supports up to {maxThreshold} players.
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
              Delete Rule
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
                  thresholdValue: normalizedThresholdValue,
                },
                existingRule?.id ?? null
              );
            }}
          >
            {existingRule ? "Save Changes" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
