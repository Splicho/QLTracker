"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  LayoutDashboard,
  Newspaper,
  PanelLeft,
  Server,
  Settings2,
} from "lucide-react";

import type { PickupPlayerDto } from "@/lib/server/pickup";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { href: "/admin", icon: LayoutDashboard, label: "Queues" },
  { href: "/admin/news", icon: Newspaper, label: "News" },
  { href: "/admin/notices", icon: BellRing, label: "Notices" },
  { href: "/admin/servers", icon: Server, label: "Servers" },
  { href: "/admin/settings", icon: Settings2, label: "Settings" },
] as const;

export function AdminShell({
  children,
  viewer,
}: {
  children: React.ReactNode;
  viewer: PickupPlayerDto;
}) {
  const pathname = usePathname();
  const initials =
    viewer.personaName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((value) => value[0]?.toUpperCase() ?? "")
      .join("") || "QA";

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="gap-4 p-3">
          <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <PanelLeft className="size-4" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-xs uppercase tracking-[0.22em] text-sidebar-foreground/60">
                QLTracker
              </p>
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                Pickup Admin
              </p>
            </div>
          </div>
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
                      : pathname.startsWith(item.href);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="p-3">
          <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-3">
            <Avatar>
              <AvatarImage alt={viewer.personaName} src={viewer.avatarUrl ?? undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {viewer.personaName}
              </p>
              <Button asChild className="mt-1 h-7 px-0 text-sidebar-foreground/60 hover:text-sidebar-foreground" variant="link">
                <Link href="/admin/logout">Sign out</Link>
              </Button>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-screen bg-[linear-gradient(180deg,#050505_0%,#121212_100%)]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/10 bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="text-white hover:bg-white/10 hover:text-white" />
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.2em] text-white/40">
              Admin
            </span>
            <span className="text-sm font-medium text-white">Pickup operations</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
