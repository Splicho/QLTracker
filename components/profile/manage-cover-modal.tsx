import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ManageCoverModal({
  coverUrl,
  isDeleting,
  onChangeCover,
  onClose,
  onDeleteCover,
  open,
}: {
  coverUrl: string;
  isDeleting: boolean;
  onChangeCover: () => void;
  onClose: () => void;
  onDeleteCover: () => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Change cover</DialogTitle>
          <DialogDescription>
            Review your current profile cover, upload a new one, or remove it.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
          <div
            className="aspect-[16/4] w-full bg-muted"
            style={{
              backgroundImage: `url(${coverUrl})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
        </div>

        <DialogFooter>
          <Button
            className="cursor-pointer"
            disabled={isDeleting}
            onClick={onDeleteCover}
            type="button"
            variant="ghost"
          >
            Delete current cover
          </Button>
          <Button
            className="cursor-pointer"
            onClick={onChangeCover}
            type="button"
          >
            Change cover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
