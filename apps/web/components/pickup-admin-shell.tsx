"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeft,
  BellRing,
  LayoutDashboard,
  LogOut,
  Newspaper,
  Server,
  Settings2,
  Trophy,
} from "lucide-react"

import type { PickupPlayerDto } from "@/lib/server/pickup"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const NAV_ITEMS = [
  { href: "/admin", icon: LayoutDashboard, label: "Queues" },
  { href: "/admin/ranks", icon: Trophy, label: "Ranks" },
  { href: "/admin/news", icon: Newspaper, label: "News" },
  { href: "/admin/notices", icon: BellRing, label: "Notices" },
  { href: "/admin/servers", icon: Server, label: "Servers" },
  { href: "/admin/settings", icon: Settings2, label: "Settings" },
] as const

export function AdminShell({
  children,
}: {
  children: React.ReactNode
  viewer: PickupPlayerDto
}) {
  const pathname = usePathname()

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="items-center p-3">
          <img
            alt="QLTracker"
            className="size-8 object-contain"
            src="/images/appicon.png"
          />
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href)

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="p-3">
          <div className="flex flex-col gap-2 group-data-[collapsible=icon]:items-center">
            <Button
              asChild
              className="h-10 w-full justify-start group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              variant="outline"
            >
              <Link href="/servers">
                <ArrowLeft />
                <span className="group-data-[collapsible=icon]:hidden">
                  Back to QLTracker
                </span>
              </Link>
            </Button>
            <form action="/admin/logout" className="w-full" method="POST">
              <Button
                className="h-10 w-full justify-start group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                type="submit"
                variant="destructive"
              >
                <LogOut />
                <span className="group-data-[collapsible=icon]:hidden">
                  Logout
                </span>
              </Button>
            </form>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-screen bg-[linear-gradient(180deg,#050505_0%,#121212_100%)]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/10 bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="text-white hover:bg-white/10 hover:text-white" />
          <div className="flex flex-col">
            <span className="text-xs tracking-[0.2em] text-white/40 uppercase">
              Admin
            </span>
            <span className="text-sm font-medium text-white">
              Pickup operations
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
