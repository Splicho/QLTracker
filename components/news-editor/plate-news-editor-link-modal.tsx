"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function PlateNewsEditorLinkModal({
  defaultText = "",
  defaultUrl = "",
  onOpenChange,
  onSubmit,
  open,
}: {
  defaultText?: string
  defaultUrl?: string
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { text: string; url: string }) => void
  open: boolean
}) {
  const [text, setText] = useState(defaultText)
  const [url, setUrl] = useState(defaultUrl)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#111111] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Insert link</DialogTitle>
          <DialogDescription className="text-white/55">
            Add the destination URL and optional link text.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label
              className="text-sm font-medium text-white/70"
              htmlFor="news-link-url"
            >
              URL
            </label>
            <Input
              id="news-link-url"
              className="border-white/10 bg-transparent text-white"
              placeholder="https://qltracker.com"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label
              className="text-sm font-medium text-white/70"
              htmlFor="news-link-text"
            >
              Text
            </label>
            <Input
              id="news-link-text"
              className="border-white/10 bg-transparent text-white"
              placeholder="Read more"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={url.trim().length === 0}
            onClick={() =>
              onSubmit({
                text: text.trim(),
                url: url.trim(),
              })
            }
          >
            Insert link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
