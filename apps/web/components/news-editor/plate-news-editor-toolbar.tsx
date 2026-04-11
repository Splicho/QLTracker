"use client"

import {
  type MouseEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImageUp,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  Type,
  Underline,
} from "lucide-react"
import type { PlateEditor } from "platejs/react"
import { toggleBulletedList, toggleNumberedList } from "@platejs/list-classic"
import { HexColorInput, HexColorPicker } from "react-colorful"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toggleVariants } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const COLOR_OPTIONS = [
  "#ffffff",
  "#f87171",
  "#fb7185",
  "#f59e0b",
  "#facc15",
  "#4ade80",
  "#2dd4bf",
  "#38bdf8",
  "#818cf8",
  "#c084fc",
] as const

const FONT_SIZE_OPTIONS = [
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "24", value: "24px" },
  { label: "30", value: "30px" },
] as const

function normalizeHexColor(value: string | null) {
  if (!value) {
    return "#ffffff"
  }

  const trimmed = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase()
  }

  return "#ffffff"
}

function ToolbarButton({
  children,
  disabled,
  label,
  onMouseDown,
}: {
  children: ReactNode
  disabled?: boolean
  label: string
  onMouseDown: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleGroupItem
          aria-label={label}
          className="text-white/75 hover:bg-white/[0.06] hover:text-white data-[state=on]:bg-white/[0.08] data-[state=on]:text-white"
          disabled={disabled}
          size="sm"
          value={label}
          variant="outline"
          onMouseDown={onMouseDown}
        >
          {children}
        </ToggleGroupItem>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function PlateNewsEditorToolbar({
  activeColor,
  activeFontSize,
  applyTextColor,
  applyTextSize,
  disabled,
  editor,
  isUploadingImage,
  onOpenLinkDialog,
  onStoreSelection,
  onUploadImage,
}: {
  activeColor: string | null
  activeFontSize: string | null
  applyTextColor: (value: string | null) => void
  applyTextSize: (value: string | null) => void
  disabled?: boolean
  editor: PlateEditor
  isUploadingImage?: boolean
  onOpenLinkDialog: () => void
  onStoreSelection: () => void
  onUploadImage: (file: File) => void
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [colorOpen, setColorOpen] = useState(false)
  const [fontSizeOpen, setFontSizeOpen] = useState(false)
  const [colorDraft, setColorDraft] = useState(normalizeHexColor(activeColor))
  const isBusy = disabled || isUploadingImage
  const selectedColor = useMemo(() => {
    if (!activeColor) {
      return null
    }

    return COLOR_OPTIONS.includes(activeColor as (typeof COLOR_OPTIONS)[number])
      ? activeColor
      : null
  }, [activeColor])

  const run =
    (callback: () => void) => (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      if (isBusy) {
        return
      }

      callback()
    }

  const handleInsertImageMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (isBusy) {
      return
    }

    onStoreSelection()
    imageInputRef.current?.click()
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-3 border-b border-white/10 px-4 py-3">
        <input
          ref={imageInputRef}
          accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
          className="hidden"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""

            if (!file || isBusy) {
              return
            }

            void onUploadImage(file)
          }}
        />

        <ToggleGroup
          className="rounded-lg"
          spacing={0}
          type="multiple"
          value={[]}
          variant="outline"
        >
          <ToolbarButton
            disabled={isBusy}
            label="Bold"
            onMouseDown={run(() => editor.tf.toggleMark("bold"))}
          >
            <Bold className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            disabled={isBusy}
            label="Italic"
            onMouseDown={run(() => editor.tf.toggleMark("italic"))}
          >
            <Italic className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            disabled={isBusy}
            label="Underline"
            onMouseDown={run(() => editor.tf.toggleMark("underline"))}
          >
            <Underline className="size-4" />
          </ToolbarButton>
        </ToggleGroup>

        <div className="flex items-center">
          <Popover
            open={colorOpen}
            onOpenChange={(open) => {
              if (open) {
                onStoreSelection()
                setColorDraft(normalizeHexColor(activeColor))
              }

              setColorOpen(open)
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    aria-label="Text color"
                    className={cn(
                      toggleVariants({ size: "sm", variant: "outline" }),
                      "rounded-r-none border-r-0 px-2 text-white/75 hover:bg-white/[0.06] hover:text-white"
                    )}
                    disabled={isBusy}
                    type="button"
                  >
                    <span className="relative flex">
                      <Palette className="size-4" />
                      <span
                        className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border border-[#111111]"
                        style={{ backgroundColor: selectedColor ?? "#6b7280" }}
                      />
                    </span>
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Text color</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-72 border-white/10 bg-[#111111] p-3 text-white">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Text color</p>
                  <p className="text-xs text-white/50">
                    Choose a preset or enter a custom hex color.
                  </p>
                </div>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
                >
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      aria-label={`Use ${color}`}
                      className={cn(
                        "aspect-square w-full rounded-md border border-white/10 transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none",
                        selectedColor === color &&
                          "ring-2 ring-white/40 ring-offset-2 ring-offset-[#111111]"
                      )}
                      style={{ backgroundColor: color }}
                      type="button"
                      onClick={() => {
                        applyTextColor(color)
                        setColorDraft(color)
                        setColorOpen(false)
                      }}
                    />
                  ))}
                </div>
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <HexColorPicker
                    className="!w-full"
                    color={colorDraft}
                    onChange={setColorDraft}
                  />
                  <HexColorInput
                    className="h-9 w-full rounded-md border border-white/10 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/35 focus-visible:border-white/20"
                    color={colorDraft}
                    onChange={setColorDraft}
                    prefixed
                  />
                  <Button
                    className="w-full border-white/10 text-white/80 hover:bg-white/[0.06] hover:text-white"
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      applyTextColor(normalizeHexColor(colorDraft))
                      setColorOpen(false)
                    }}
                  >
                    Apply custom color
                  </Button>
                </div>
                <Button
                  className="w-full border-white/10 text-white/80 hover:bg-white/[0.06] hover:text-white"
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    applyTextColor(null)
                    setColorOpen(false)
                  }}
                >
                  Reset color
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover
            open={fontSizeOpen}
            onOpenChange={(open) => {
              if (open) {
                onStoreSelection()
              }

              setFontSizeOpen(open)
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    aria-label="Text size"
                    className={cn(
                      toggleVariants({ size: "sm", variant: "outline" }),
                      "rounded-l-none px-2 text-white/75 hover:bg-white/[0.06] hover:text-white"
                    )}
                    disabled={isBusy}
                    type="button"
                  >
                    <Type className="size-4" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Text size</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48 border-white/10 bg-[#111111] p-3 text-white">
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Text size</p>
                  <p className="text-xs text-white/50">
                    Apply a preset size to the selected text.
                  </p>
                </div>
                <div className="grid gap-1">
                  {FONT_SIZE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      className={cn(
                        "justify-start border-white/10 text-white/80 hover:bg-white/[0.06] hover:text-white",
                        activeFontSize === option.value &&
                          "bg-white/[0.08] text-white"
                      )}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => {
                        applyTextSize(option.value)
                        setFontSizeOpen(false)
                      }}
                    >
                      {option.label}px
                    </Button>
                  ))}
                </div>
                <Button
                  className="w-full border-white/10 text-white/80 hover:bg-white/[0.06] hover:text-white"
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    applyTextSize(null)
                    setFontSizeOpen(false)
                  }}
                >
                  Reset size
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <ToggleGroup
          className="rounded-lg"
          spacing={0}
          type="multiple"
          value={[]}
          variant="outline"
        >
          <ToolbarButton
            disabled={isBusy}
            label="Heading 1"
            onMouseDown={run(() => editor.tf.toggleBlock("h1"))}
          >
            <Heading1 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            disabled={isBusy}
            label="Heading 2"
            onMouseDown={run(() => editor.tf.toggleBlock("h2"))}
          >
            <Heading2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            disabled={isBusy}
            label="Heading 3"
            onMouseDown={run(() => editor.tf.toggleBlock("h3"))}
          >
            <Heading3 className="size-4" />
          </ToolbarButton>
        </ToggleGroup>

        <ToggleGroup
          className="rounded-lg"
          spacing={0}
          type="multiple"
          value={[]}
          variant="outline"
        >
          <ToolbarButton
            disabled={isBusy}
            label="Bulleted list"
            onMouseDown={run(() => toggleBulletedList(editor))}
          >
            <List className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            disabled={isBusy}
            label="Numbered list"
            onMouseDown={run(() => toggleNumberedList(editor))}
          >
            <ListOrdered className="size-4" />
          </ToolbarButton>
        </ToggleGroup>

        <ToggleGroup
          className="rounded-lg"
          spacing={0}
          type="multiple"
          value={[]}
          variant="outline"
        >
          <ToolbarButton
            disabled={isBusy}
            label="Insert divider"
            onMouseDown={run(() =>
              editor.tf.insertNodes([
                {
                  children: [{ text: "" }],
                  type: "hr",
                },
                {
                  children: [{ text: "" }],
                  type: "p",
                },
              ])
            )}
          >
            <Minus className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            disabled={isBusy}
            label="Insert link"
            onMouseDown={run(() => {
              onStoreSelection()
              onOpenLinkDialog()
            })}
          >
            <Link2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            disabled={isBusy}
            label={isUploadingImage ? "Uploading image" : "Insert image"}
            onMouseDown={handleInsertImageMouseDown}
          >
            <ImageUp
              className={cn("size-4", isUploadingImage && "animate-pulse")}
            />
          </ToolbarButton>
        </ToggleGroup>
      </div>
    </TooltipProvider>
  )
}
