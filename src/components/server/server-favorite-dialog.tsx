import { Spinner } from "@/components/icon";
import { QuakeText } from "@/lib/quake";
import type { SteamServer } from "@/lib/steam";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";

type FavoriteListOption = {
  id: string;
  name: string;
};

export function ServerFavoriteDialog({
  open,
  server,
  actionMode,
  favoriteListId,
  lists,
  targetListId,
  pendingAction,
  onOpenChange,
  onTargetListChange,
  onRemove,
  onSave,
}: {
  open: boolean;
  server: SteamServer | null;
  actionMode: "add" | "edit";
  favoriteListId: string | null;
  lists: FavoriteListOption[];
  targetListId: string;
  pendingAction: "save" | "remove" | null;
  onOpenChange: (open: boolean) => void;
  onTargetListChange: (value: string) => void;
  onRemove: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {actionMode === "edit"
              ? t("serverList.favoriteDialog.editTitle")
              : t("serverList.favoriteDialog.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {server ? (
              <span className="block truncate">
                <QuakeText text={server.name} />
              </span>
            ) : (
              t("serverList.favoriteDialog.fallbackDescription")
            )}
          </DialogDescription>
        </DialogHeader>

        {lists.length > 0 ? (
          <Select value={targetListId} onValueChange={onTargetListChange}>
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={t("serverList.favoriteDialog.selectList")}
              />
            </SelectTrigger>
            <SelectContent>
              {lists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("serverList.favoriteDialog.listsUnavailable")}
          </p>
        )}

        <DialogFooter>
          {actionMode === "edit" && favoriteListId ? (
            <Button
              type="button"
              variant="outline"
              disabled={pendingAction !== null}
              onClick={onRemove}
            >
              {pendingAction === "remove" ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="size-4" />
                  {t("serverList.favoriteDialog.remove")}
                </span>
              ) : (
                t("serverList.favoriteDialog.remove")
              )}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={
              pendingAction !== null ||
              !server ||
              !targetListId ||
              lists.length === 0 ||
              (actionMode === "edit" && targetListId === favoriteListId)
            }
            onClick={onSave}
          >
            {pendingAction === "save" ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" />
                {actionMode === "edit"
                  ? t("serverList.favoriteDialog.saveChanges")
                  : t("serverList.favoriteDialog.addToList")}
              </span>
            ) : actionMode === "edit" ? (
              t("serverList.favoriteDialog.saveChanges")
            ) : (
              t("serverList.favoriteDialog.addToList")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
