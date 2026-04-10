import type { KeyboardEvent } from "react";
import { stripQuakeColors } from "@/lib/quake";
import type { SteamServer } from "@/lib/steam";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useTranslation } from "react-i18next";

export function ServerPasswordDialog({
  open,
  server,
  password,
  rememberPassword,
  onOpenChange,
  onPasswordChange,
  onRememberPasswordChange,
  onSubmit,
}: {
  open: boolean;
  server: SteamServer | null;
  password: string;
  rememberPassword: boolean;
  onOpenChange: (open: boolean) => void;
  onPasswordChange: (value: string) => void;
  onRememberPasswordChange: (value: boolean) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || !server || !password.trim()) {
      return;
    }

    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("serverList.passwordDialog.title")}</DialogTitle>
          <DialogDescription>
            {server
              ? t("serverList.passwordDialog.descriptionWithServer", {
                  server: stripQuakeColors(server.name),
                })
              : t("serverList.passwordDialog.fallbackDescription")}
          </DialogDescription>
        </DialogHeader>

        <Input
          type="password"
          autoFocus
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("serverList.passwordDialog.inputPlaceholder")}
        />

        <div className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
          <Checkbox
            id="remember-server-password"
            checked={rememberPassword}
            onCheckedChange={(checked) =>
              onRememberPasswordChange(checked === true)
            }
            className="mt-0.5"
          />
          <Label
            htmlFor="remember-server-password"
            className="cursor-pointer text-sm font-normal leading-snug text-muted-foreground"
          >
            {t("serverList.passwordDialog.remember")}
          </Label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={!server || !password.trim()}
            onClick={onSubmit}
          >
            {t("serverList.passwordDialog.join")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
