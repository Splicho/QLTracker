import { useEffect, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { createCroppedImageFile, type CropArea } from "@/lib/image-crop"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function CropImageDialog({
  aspect = 16 / 4,
  description,
  file,
  fileName,
  onClose,
  onSave,
  open,
  title,
}: {
  aspect?: number
  description: string
  file: File | null
  fileName: string
  onClose: () => void
  onSave: (file: File) => Promise<void>
  open: boolean
  title: string
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(
    null
  )
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!file) {
      setImageUrl(null)
      return
    }

    const nextUrl = URL.createObjectURL(file)
    setImageUrl(nextUrl)

    return () => {
      URL.revokeObjectURL(nextUrl)
    }
  }, [file])

  useEffect(() => {
    if (!open) {
      setCrop({ x: 0, y: 0 })
      setCroppedAreaPixels(null)
      setZoom(1)
    }
  }, [open])

  const handleSave = async () => {
    if (!file || !imageUrl || !croppedAreaPixels) {
      return
    }

    try {
      setIsSaving(true)
      const croppedFile = await createCroppedImageFile(
        imageUrl,
        croppedAreaPixels,
        fileName
      )
      await onSave(croppedFile)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cover crop failed.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="max-w-3xl p-0" showCloseButton={!isSaving}>
        <DialogHeader className="border-b border-border px-6 pt-6 pb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <div className="relative h-[360px] overflow-hidden rounded-xl border border-border bg-sidebar">
            {imageUrl ? (
              <Cropper
                aspect={aspect}
                crop={crop}
                image={imageUrl}
                onCropChange={setCrop}
                onCropComplete={(_, pixels: Area) =>
                  setCroppedAreaPixels(pixels as CropArea)
                }
                onZoomChange={setZoom}
                showGrid={false}
                zoom={zoom}
              />
            ) : null}
          </div>
          <input
            aria-label={`${title} zoom`}
            className="mt-5 w-full accent-primary"
            max={3}
            min={1}
            onChange={(event) => setZoom(Number(event.target.value))}
            step={0.05}
            type="range"
            value={zoom}
          />
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            className="cursor-pointer"
            disabled={isSaving}
            onClick={onClose}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            className="cursor-pointer"
            disabled={!file || isSaving}
            onClick={() => void handleSave()}
            type="button"
          >
            {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
