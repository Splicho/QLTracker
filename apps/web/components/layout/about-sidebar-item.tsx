"use client"

import { useState } from "react"
import packageJson from "../../package.json"
import { Discord, Github, InfoCircle } from "@/components/icon"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { openExternalUrl } from "@/lib/open-url"

export function AboutSidebarItem() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <SidebarMenu>
        <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <SidebarMenuButton
            asChild
            className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
            size="lg"
          >
            <DialogTrigger asChild>
              <button type="button">
                <InfoCircle />
                <span className="group-data-[collapsible=icon]:hidden">
                  About
                </span>
              </button>
            </DialogTrigger>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <img
            alt="QLTracker app icon"
            className="size-14 rounded-xl object-contain"
            src="/images/appicon.png"
          />
          <DialogTitle>QLTracker</DialogTitle>
          <DialogDescription>
            Quake Live server browser and pickup platform.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 rounded-lg border border-border p-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Version</span>
            <span className="font-medium text-foreground">
              v{packageJson.version}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Socials</span>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <button
                className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border hover:bg-muted"
                onClick={() => openExternalUrl("https://discord.gg/qltracker")}
                type="button"
              >
                <Discord className="size-4" />
              </button>
              <button
                className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border hover:bg-muted"
                onClick={() =>
                  openExternalUrl("https://github.com/Splicho/QLTracker")
                }
                type="button"
              >
                <Github className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
