import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuakeText, stripQuakeColors } from "@/lib/quake";
import type { TrackedPlayer } from "@/lib/tracked-players";

type TrackedPlayerAliasesDialogProps = {
  aliases: string[];
  open: boolean;
  trackedPlayer: TrackedPlayer | null;
  onOpenChange: (open: boolean) => void;
};

export function TrackedPlayerAliasesDialog({
  aliases,
  open,
  trackedPlayer,
  onOpenChange,
}: TrackedPlayerAliasesDialogProps) {
  const { t } = useTranslation();
  const playerLabel = trackedPlayer
    ? stripQuakeColors(trackedPlayer.playerName)
    : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("watchlist.aliasHistoryDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("watchlist.aliasHistoryDialogDescription", {
              player: playerLabel,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {t("watchlist.currentNickname")}
            </div>
            <div className="mt-2 text-base font-medium text-foreground">
              {trackedPlayer ? <QuakeText text={trackedPlayer.playerName} /> : null}
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {t("watchlist.previousNicknames")}
            </div>
            {aliases.length > 0 ? (
              <div className="mt-3 space-y-2">
                {aliases.map((alias) => (
                  <div
                    key={`${trackedPlayer?.steamId ?? "tracked-player"}-${alias}`}
                    className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground"
                  >
                    <QuakeText text={alias} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("watchlist.aliasHistoryEmpty")}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
