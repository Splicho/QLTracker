"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import NumberFlow from "@number-flow/react"
import { ArrowLeft, Cookie, Shield, Users } from "lucide-react"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import packageJson from "../../package.json"
import { useQuery } from "@tanstack/react-query"
import {
  Cog,
  Discord,
  Eye,
  Flask,
  GameController,
  Github,
  HeartOutline,
  InfoCircle,
  Leaderboard,
  Medal,
  News,
  ServerStack,
} from "@/components/icon"
import { useFavorites } from "@/hooks/use-favorites"
import { useTrackedPlayers } from "@/hooks/use-tracked-players"
import { fetchNewsArticlesQuery, newsQueryKeys } from "@/lib/news-query"
import {
  READ_NEWS_SLUGS_COOKIE_NAME,
  getReadNewsSlugsCookieMaxAge,
  parseReadNewsSlugsCookie,
  serializeReadNewsSlugsCookie,
} from "@/lib/news-read-state"
import { type PickupPlayer } from "@/lib/pickup"
import {
  fetchRealtimePlayerPresenceLookup,
  isRealtimeEnabled,
} from "@/lib/realtime"
import {
  settingsNavigationItems,
  type SettingsSectionId,
} from "@/lib/settings-navigation"
import type { NewsArticleDto } from "@/lib/server/news"
import { openExternalUrl } from "@/lib/open-url"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useLiveServers } from "@/hooks/use-live-servers"

type NavItem = {
  href: string
  icon: React.ComponentType<{ className?: string }>
  id: string
  label: string
}

const newsNavigationItems: readonly NavItem[] = [
  { href: "/news", icon: News, id: "news", label: "News" },
] as const

const primaryNavigationItems: readonly NavItem[] = [
  { href: "/servers", icon: ServerStack, id: "servers", label: "Server List" },
  {
    href: "/favorites",
    icon: HeartOutline,
    id: "favorites",
    label: "Favorites",
  },
  { href: "/watchlist", icon: Eye, id: "watchlist", label: "Watchlist" },
] as const

const competitiveNavigationItems: readonly NavItem[] = [
  { href: "/pickup", icon: Medal, id: "pickup", label: "Pickup" },
  {
    href: "/leaderboards",
    icon: Leaderboard,
    id: "leaderboards",
    label: "Leaderboard",
  },
] as const

const NEWS_READ_STATE_EVENT = "qltracker-news-read-state"

function readNewsSlugsCookieSnapshot() {
  if (typeof document === "undefined") {
    return ""
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${READ_NEWS_SLUGS_COOKIE_NAME}=([^;]*)`)
  )

  return match ? decodeURIComponent(match[1]) : ""
}

function isItemActive(pathname: string, href: string) {
  if (href === "/servers") {
    return pathname === "/" || pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function getSettingsHref(section: SettingsSectionId) {
  if (section === "pickup-profile") {
    return "/settings/profile"
  }

  if (section === "import-data") {
    return "/settings/import-data"
  }

  return "/settings"
}

export function AppSidebar({
  initialNewsArticles = [],
  initialReadNewsSlugs = [],
  pickupPlayer,
  pickupQueueCount = null,
  noticeVisible = false,
}: {
  initialNewsArticles?: NewsArticleDto[]
  initialReadNewsSlugs?: string[]
  pickupPlayer?: PickupPlayer | null
  pickupQueueCount?: number | null
  noticeVisible?: boolean
}) {
  const lastAppPathStorageKey = "qltracker-last-app-path"
  const pathname = usePathname() ?? "/servers"
  const [aboutOpen, setAboutOpen] = useState(false)
  const { state: favoritesState } = useFavorites()
  const { players: trackedPlayers } = useTrackedPlayers()
  const { servers: liveServers } = useLiveServers()
  const realtimeAvailable = isRealtimeEnabled()
  const isSettingsPage = pathname.startsWith("/settings")
  const settingsSection: SettingsSectionId = pathname.startsWith(
    "/settings/profile"
  )
    ? "pickup-profile"
    : pathname.startsWith("/settings/import-data")
      ? "import-data"
      : "general"
  const availableSettingsItems = useMemo(
    () =>
      settingsNavigationItems.filter(
        (item) => item.id !== "pickup-profile" || pickupPlayer != null
      ),
    [pickupPlayer]
  )
  const trackedSteamIds = useMemo(
    () => trackedPlayers.map((player) => player.steamId),
    [trackedPlayers]
  )
  const trackedPresenceQuery = useQuery({
    queryKey: ["realtime", "presence-lookup", trackedSteamIds],
    queryFn: () => fetchRealtimePlayerPresenceLookup(trackedSteamIds),
    enabled: realtimeAvailable && trackedSteamIds.length > 0,
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: (previous) => previous,
  })
  const latestNewsArticleQuery = useQuery({
    queryKey: newsQueryKeys.articles,
    queryFn: fetchNewsArticlesQuery,
    initialData: initialNewsArticles,
    staleTime: 60_000,
  })
  const readNewsSlugsSnapshot = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => undefined
      }

      const handleChange = () => onStoreChange()
      window.addEventListener(NEWS_READ_STATE_EVENT, handleChange)

      return () => {
        window.removeEventListener(NEWS_READ_STATE_EVENT, handleChange)
      }
    },
    readNewsSlugsCookieSnapshot,
    () => serializeReadNewsSlugsCookie(initialReadNewsSlugs)
  )
  const readNewsSlugs = useMemo(
    () => parseReadNewsSlugsCookie(readNewsSlugsSnapshot),
    [readNewsSlugsSnapshot]
  )
  const onlineTrackedPlayerCount = useMemo(
    () =>
      Object.values(trackedPresenceQuery.data ?? {}).filter(
        (presence) => presence != null
      ).length,
    [trackedPresenceQuery.data]
  )
  const favoritePlayerCount = useMemo(() => {
    if (favoritesState.servers.length === 0 || liveServers.length === 0) {
      return 0
    }

    const favoriteAddresses = new Set(
      favoritesState.servers.map((server) => server.addr)
    )

    return liveServers.reduce((sum, server) => {
      if (!favoriteAddresses.has(server.addr)) {
        return sum
      }

      return sum + (server.players ?? 0)
    }, 0)
  }, [favoritesState.servers, liveServers])
  const overallQuakeLivePlayers = useMemo(
    () => liveServers.reduce((sum, server) => sum + (server.players ?? 0), 0),
    [liveServers]
  )
  const currentNewsSlug = useMemo(() => {
    if (!pathname.startsWith("/news/")) {
      return null
    }

    const slug = pathname.slice("/news/".length).split("/")[0]
    return slug ? decodeURIComponent(slug) : null
  }, [pathname])
  const unreadNewsCount = useMemo(() => {
    const readSlugs = new Set(readNewsSlugs)

    if (currentNewsSlug) {
      readSlugs.add(currentNewsSlug)
    }

    return (latestNewsArticleQuery.data ?? []).reduce((count, article) => {
      return readSlugs.has(article.slug) ? count : count + 1
    }, 0)
  }, [currentNewsSlug, latestNewsArticleQuery.data, readNewsSlugs])

  useEffect(() => {
    if (!currentNewsSlug || readNewsSlugs.includes(currentNewsSlug)) {
      return
    }

    const encodedValue = encodeURIComponent(
      serializeReadNewsSlugsCookie([currentNewsSlug, ...readNewsSlugs])
    )
    document.cookie = `${READ_NEWS_SLUGS_COOKIE_NAME}=${encodedValue}; path=/; max-age=${getReadNewsSlugsCookieMaxAge()}`
    window.dispatchEvent(new Event(NEWS_READ_STATE_EVENT))
  }, [currentNewsSlug, readNewsSlugs])
  const lastAppPath = useMemo(() => {
    if (!isSettingsPage) {
      return pathname
    }

    try {
      return window.sessionStorage.getItem(lastAppPathStorageKey) ?? "/servers"
    } catch {
      return "/servers"
    }
  }, [isSettingsPage, lastAppPathStorageKey, pathname])
  const backToAppHref =
    lastAppPath.startsWith("/settings") || !lastAppPath
      ? "/servers"
      : lastAppPath

  useEffect(() => {
    if (isSettingsPage) {
      return
    }

    try {
      window.sessionStorage.setItem(lastAppPathStorageKey, pathname)
    } catch {
      // Ignore sessionStorage failures in unsupported environments.
    }
  }, [isSettingsPage, lastAppPathStorageKey, pathname])

  const renderNavigationItem = (item: NavItem) => {
    const active = isItemActive(pathname, item.href)

    return (
      <SidebarMenuItem
        key={item.id}
        className="relative group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
      >
        <SidebarMenuButton
          asChild
          className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
          isActive={active}
          size="lg"
          tooltip={item.label}
        >
          <Link href={item.href}>
            <item.icon />
            <span className="group-data-[collapsible=icon]:hidden">
              {item.label}
            </span>
          </Link>
        </SidebarMenuButton>
        {item.id === "pickup" ? (
          <SidebarMenuBadge className="pointer-events-auto top-1/2 right-2 z-[150] h-6 min-w-6 -translate-y-1/2 gap-1.5 rounded-md border border-yellow-500/30 bg-yellow-500/12 px-2 text-[11px] leading-none font-semibold text-yellow-700 peer-data-[size=default]/menu-button:top-1/2 peer-data-[size=lg]/menu-button:top-1/2 peer-data-[size=sm]/menu-button:top-1/2 dark:text-yellow-300">
            <Flask className="size-3" />
            <span>ALPHA</span>
          </SidebarMenuBadge>
        ) : item.id === "favorites" && favoritesState.servers.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuBadge className="pointer-events-auto top-1/2 right-2 z-[150] h-6 min-w-6 -translate-y-1/2 gap-1.5 rounded-md border border-sidebar-border/70 bg-muted px-2 text-xs leading-none peer-data-[size=default]/menu-button:top-1/2 peer-data-[size=lg]/menu-button:top-1/2 peer-data-[size=sm]/menu-button:top-1/2">
                <GameController className="size-3" />
                <span>{favoritePlayerCount}</span>
              </SidebarMenuBadge>
            </TooltipTrigger>
            <TooltipContent side="top">
              {favoritePlayerCount} players on favorite servers
            </TooltipContent>
          </Tooltip>
        ) : item.id === "watchlist" &&
          trackedPlayers.length > 0 &&
          realtimeAvailable &&
          !trackedPresenceQuery.isError ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuBadge className="pointer-events-auto top-1/2 right-2 z-[150] h-6 min-w-6 -translate-y-1/2 gap-1.5 rounded-md border border-sidebar-border/70 bg-muted px-2 text-xs leading-none peer-data-[size=default]/menu-button:top-1/2 peer-data-[size=lg]/menu-button:top-1/2 peer-data-[size=sm]/menu-button:top-1/2">
                <GameController className="size-3" />
                <span>{onlineTrackedPlayerCount}</span>
              </SidebarMenuBadge>
            </TooltipTrigger>
            <TooltipContent side="top">
              {onlineTrackedPlayerCount} online
            </TooltipContent>
          </Tooltip>
        ) : item.id === "news" && unreadNewsCount > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarMenuBadge className="pointer-events-auto top-1/2 right-2 z-[150] -translate-y-1/2 bg-transparent p-0 peer-data-[size=default]/menu-button:top-1/2 peer-data-[size=lg]/menu-button:top-1/2 peer-data-[size=sm]/menu-button:top-1/2">
                <Badge
                  variant="destructive"
                  className="size-5 rounded-full p-0 text-[11px] font-semibold"
                >
                  {unreadNewsCount}
                </Badge>
              </SidebarMenuBadge>
            </TooltipTrigger>
            <TooltipContent side="top">
              {unreadNewsCount} unread{" "}
              {unreadNewsCount === 1 ? "article" : "articles"}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar
      className={noticeVisible ? "!top-12 !h-[calc(100svh-3rem)] !p-0" : "!p-0"}
      collapsible="icon"
      variant="inset"
    >
      <SidebarHeader>
        <div className="relative h-14 px-2">
          <div className="absolute inset-y-0 left-2 flex items-center group-data-[collapsible=icon]:hidden">
            <img
              alt="QLTracker"
              className="h-8 w-auto object-contain dark:hidden"
              src="/images/logo-dark.png"
            />
            <img
              alt="QLTracker"
              className="hidden h-8 w-auto object-contain dark:block"
              src="/images/logo.png"
            />
          </div>
          <img
            alt="QLTracker app icon"
            className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 object-contain opacity-0 transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:opacity-100"
            src="/images/appicon.png"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {isSettingsPage ? (
          <SidebarGroup>
            <SidebarGroupLabel className="tracking-[0.18em] uppercase">
              Settings
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {availableSettingsItems.map((item) => (
                  <SidebarMenuItem
                    key={item.id}
                    className="relative group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                  >
                    <SidebarMenuButton
                      asChild
                      className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
                      isActive={settingsSection === item.id}
                      size="lg"
                      tooltip={item.title}
                    >
                      <Link href={getSettingsHref(item.id)}>
                        <item.icon />
                        <span className="group-data-[collapsible=icon]:hidden">
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
              <div className="grid grid-cols-2 overflow-hidden rounded-md border border-sidebar-border bg-sidebar-accent/35">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex min-w-0 items-center gap-2 px-3 py-2">
                      <GameController className="size-3.5 shrink-0 text-muted-foreground" />
                      <NumberFlow
                        className="truncate text-sm font-semibold text-foreground"
                        value={overallQuakeLivePlayers}
                      />
                      <span className="relative inline-flex size-2 shrink-0">
                        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {overallQuakeLivePlayers} players on Quake Live servers
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex min-w-0 items-center gap-2 border-l border-sidebar-border px-3 py-2">
                      <Users className="size-3.5 shrink-0 text-muted-foreground" />
                      <NumberFlow
                        className="truncate text-sm font-semibold text-foreground"
                        value={pickupQueueCount ?? 0}
                      />
                      <span className="relative inline-flex size-2 shrink-0">
                        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {pickupQueueCount ?? 0} players currently in pickup queue
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <SidebarGroup>
              <SidebarGroupLabel className="tracking-[0.18em] uppercase">
                News
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {newsNavigationItems.map(renderNavigationItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel className="tracking-[0.18em] uppercase">
                QLTracker
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {primaryNavigationItems.map(renderNavigationItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel className="tracking-[0.18em] uppercase">
                Competitive
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {competitiveNavigationItems.map(renderNavigationItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter className="px-2 py-2 group-data-[collapsible=icon]:px-0">
        <SidebarMenu>
          {isSettingsPage ? (
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                asChild
                className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
                size="lg"
                tooltip="Back to App"
              >
                <Link href={backToAppHref}>
                  <ArrowLeft className="size-5" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Back to App
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                asChild
                className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
                isActive={pathname.startsWith("/settings")}
                size="lg"
                tooltip="Settings"
              >
                <Link href="/settings">
                  <Cog />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Settings
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        <div className="border-t border-sidebar-border" />
        <SidebarMenu>
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              asChild
              className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
              size="lg"
              tooltip="Discord"
            >
              <button
                onClick={() => openExternalUrl("https://discord.gg/qltracker")}
                type="button"
              >
                <Discord />
                <span className="group-data-[collapsible=icon]:hidden">
                  Discord
                </span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Dialog onOpenChange={setAboutOpen} open={aboutOpen}>
          <SidebarMenu>
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                asChild
                className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
                isActive={pathname.startsWith("/privacy-policy")}
                size="lg"
                tooltip="Privacy Policy"
              >
                <Link href="/privacy-policy">
                  <Shield className="size-5" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Privacy Policy
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                asChild
                className="cursor-pointer group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!p-0 [&_svg]:size-5!"
                isActive={pathname.startsWith("/cookie-policy")}
                size="lg"
                tooltip="Cookie Policy"
              >
                <Link href="/cookie-policy">
                  <Cookie className="size-5" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Cookie Policy
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="border-t border-sidebar-border" />
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
                    onClick={() =>
                      openExternalUrl("https://discord.gg/qltracker")
                    }
                    type="button"
                  >
                    <Discord className="size-4" />
                  </button>
                  <button
                    className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border hover:bg-muted"
                    onClick={() =>
                      openExternalUrl(
                        "https://github.com/Splicho/qltracker-web"
                      )
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
      </SidebarFooter>
    </Sidebar>
  )
}
