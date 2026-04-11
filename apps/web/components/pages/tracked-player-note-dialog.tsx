import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { stripQuakeColors } from "@/lib/quake"
import type { TrackedPlayer } from "@/lib/tracked-players"

type TrackedPlayerNoteDialogProps = {
  open: boolean
  trackedPlayer: TrackedPlayer | null
  onOpenChange: (open: boolean) => void
  onSaveNote: (steamId: string, note: string) => boolean
}

export function TrackedPlayerNoteDialog({
  open,
  trackedPlayer,
  onOpenChange,
  onSaveNote,
}: TrackedPlayerNoteDialogProps) {
  const dialogKey = trackedPlayer?.steamId ?? "tracked-player-note"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <TrackedPlayerNoteDialogContent
          key={dialogKey}
          trackedPlayer={trackedPlayer}
          onOpenChange={onOpenChange}
          onSaveNote={onSaveNote}
        />
      ) : null}
    </Dialog>
  )
}

function TrackedPlayerNoteDialogContent({
  trackedPlayer,
  onOpenChange,
  onSaveNote,
}: Omit<TrackedPlayerNoteDialogProps, "open">) {
  const { t } = useTranslation()
  const [draftNote, setDraftNote] = useState(trackedPlayer?.note ?? "")
  const playerLabel = trackedPlayer
    ? stripQuakeColors(trackedPlayer.playerName)
    : ""

  const handleClear = () => {
    if (!trackedPlayer) {
      return
    }

    const didChange = onSaveNote(trackedPlayer.steamId, "")
    onOpenChange(false)
    if (didChange) {
      toast.success(
        t("watchlist.toasts.noteCleared", {
          player: playerLabel,
        })
      )
    }
  }

  const handleSave = () => {
    if (!trackedPlayer) {
      return
    }

    const didChange = onSaveNote(trackedPlayer.steamId, draftNote)
    onOpenChange(false)
    if (didChange) {
      toast.success(
        t("watchlist.toasts.noteSaved", {
          player: playerLabel,
        })
      )
    }
  }

  return (
    <DialogContent
      className="sm:max-w-2xl!"
      onOpenAutoFocus={(event) => {
        event.preventDefault()
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("watchlist.noteDialog.title")}</DialogTitle>
        <DialogDescription>
          {t("watchlist.noteDialog.description", {
            player: playerLabel,
          })}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground">
          {t("watchlist.noteDialog.label")}
        </div>
        <Textarea
          className="min-h-64"
          value={draftNote}
          maxLength={500}
          placeholder={t("watchlist.noteDialog.placeholder")}
          onChange={(event) => {
            setDraftNote(event.target.value)
          }}
        />
        <p className="text-xs text-muted-foreground">
          {t("watchlist.noteDialog.hint")}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={handleClear}>
          {t("watchlist.noteDialog.clear")}
        </Button>
        <Button type="button" onClick={handleSave}>
          {t("watchlist.noteDialog.save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
