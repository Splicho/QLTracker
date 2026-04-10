import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function isAcceptedImage(file: File) {
  return ACCEPTED_IMAGE_TYPES.includes(file.type);
}

export function UploadCoverModal({
  description,
  hint,
  onClose,
  onPickFile,
  open,
  title,
}: {
  description: string;
  hint: string;
  onClose: () => void;
  onPickFile: (file: File) => void;
  open: boolean;
  title: string;
}) {
  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      {open ? (
        <UploadCoverModalContent
          description={description}
          hint={hint}
          onClose={onClose}
          onPickFile={onPickFile}
          title={title}
        />
      ) : null}
    </Dialog>
  );
}

function UploadCoverModalContent({
  description,
  hint,
  onClose,
  onPickFile,
  title,
}: {
  description: string;
  hint: string;
  onClose: () => void;
  onPickFile: (file: File) => void;
  title: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file || !isAcceptedImage(file)) {
        return;
      }

      onPickFile(file);
    },
    [onPickFile],
  );

  useEffect(() => {
    const handleWindowDragOver = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(true);
    };

    const handleWindowDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      handleFiles(event.dataTransfer?.files ?? null);
    };

    const handleWindowDragLeave = (event: DragEvent) => {
      if (event.clientX === 0 && event.clientY === 0) {
        setIsDragging(false);
      }
    };

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragleave", handleWindowDragLeave);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragleave", handleWindowDragLeave);
    };
  }, [handleFiles]);

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div
        className={`flex min-h-64 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/8"
            : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/30"
        }`}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget.contains(event.relatedTarget as Node)) {
            return;
          }
          setIsDragging(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
      >
        <UploadCloud className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Drop image
          </p>
          <p className="text-sm text-muted-foreground">
            Or click to browse from your computer.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>

      <input
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
        ref={inputRef}
        type="file"
      />

      <DialogFooter>
        <Button
          className="cursor-pointer"
          onClick={onClose}
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
